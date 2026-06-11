// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IOracleAdapter} from "./IOracleAdapter.sol";
import {ISigmaCore} from "./ISigmaCore.sol";

/// @title SigmaVault
/// @notice Non-custodial collateral vault: users deposit tokenized stocks and
///         can borrow USDC against the basket up to a VaR-bounded max LTV
///         computed on-chain by Sigma Core (Stylus).
///
/// @dev Scale conventions:
///      - Stock tokens use 18 decimals (per MockRHStock).
///      - Oracle prices are USDC-denominated, 1e18-scaled (WAD).
///      - Position values and debt accounted in USDC 6-decimal.
///      - VaR returned from Sigma Core in USDC 6-decimal.
contract SigmaVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant WAD = 1e18;
    uint256 public constant MAX_STOCKS = 16;
    uint256 public constant LIQUIDATION_BONUS_WAD = 1.05e18;
    uint256 public constant LIQUIDATION_CLOSE_FACTOR_WAD = 0.5e18;

    // -- Immutable wiring ----------------------------------------------------

    IERC20 public immutable usdc;
    ISigmaCore public sigmaCore;
    IOracleAdapter public oracle;

    // -- Governance-set parameters ------------------------------------------

    address[] public stocks;
    mapping(address => bool) public isSupported;

    /// Per-stock annualized volatility (WAD).
    mapping(address => uint256) public vol;

    /// Pairwise correlations (signed WAD). corr[a][b] == corr[b][a].
    mapping(address => mapping(address => int256)) public corr;

    /// Critical z-score in WAD (e.g. 1.645e18 ≈ 95% one-sided).
    uint256 public zScore = 1_645_000_000_000_000_000;

    /// √(time horizon in years), WAD. Default is daily ≈ √(1/252).
    uint256 public horizonSqrt = 62_994_079_237_678_000;

    /// Safety factor applied to VaR when computing max borrow (WAD).
    /// max_borrow = portfolio_value − (safety_factor · VaR).
    uint256 public varSafetyFactor = 2_000_000_000_000_000_000; // 2x by default

    /// Hard LTV ceiling that remains effective if VaR is zero or understated.
    uint256 public maxLtvWad = 0.8e18;

    // -- Per-user state ------------------------------------------------------

    mapping(address => mapping(address => uint256)) public collateral; // user -> stock -> amount
    mapping(address => uint256) public debt; // user -> USDC owed (6-dec)

    /// Optional per-user executor authorized to perform actions on the user's behalf.
    mapping(address => address) public executor;

    // -- Events --------------------------------------------------------------

    event Deposited(address indexed user, address indexed stock, uint256 amount);
    event Withdrawn(address indexed user, address indexed stock, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        address indexed seizedStock,
        uint256 repaidUsdc,
        uint256 seizedAmount
    );
    event SupportedStockAdded(address indexed stock, uint256 volWad);
    event VolatilityUpdated(address indexed stock, uint256 volWad);
    event CorrelationSet(address indexed a, address indexed b, int256 rhoWad);
    event RiskParamsUpdated(uint256 zScore, uint256 horizonSqrt, uint256 varSafetyFactor);
    event MaxLtvUpdated(uint256 maxLtvWad);
    event ExecutorSet(address indexed user, address indexed executor);

    // -- Errors --------------------------------------------------------------

    error NotSupported();
    error InsufficientCollateral();
    error Unhealthy();
    error Healthy();
    error ZeroAmount();
    error NotExecutor();
    error InvalidAddress();
    error InvalidRiskParameter();
    error TooManyStocks();
    error UnsupportedDecimals();
    error ExcessiveSeizure();

    // -- Constructor ---------------------------------------------------------

    constructor(IERC20 usdc_, ISigmaCore sigmaCore_, IOracleAdapter oracle_, address initialOwner)
        Ownable(initialOwner)
    {
        if (address(usdc_) == address(0) || address(sigmaCore_) == address(0) || address(oracle_) == address(0)) revert InvalidAddress();
        usdc = usdc_;
        sigmaCore = sigmaCore_;
        oracle = oracle_;
    }

    // -- Admin ---------------------------------------------------------------

    function addStock(address stock, uint256 volWad) external onlyOwner {
        if (stock == address(0) || stock.code.length == 0) revert InvalidAddress();
        if (stocks.length >= MAX_STOCKS) revert TooManyStocks();
        if (IERC20Metadata(stock).decimals() != 18) revert UnsupportedDecimals();
        if (volWad == 0 || volWad > 5e18) revert InvalidRiskParameter();
        require(!isSupported[stock], "exists");
        isSupported[stock] = true;
        stocks.push(stock);
        vol[stock] = volWad;
        // Self-correlation is +1 by definition.
        corr[stock][stock] = int256(uint256(1e18));
        emit SupportedStockAdded(stock, volWad);
    }

    /// @notice Update the annualized volatility of a supported stock. VaR is a
    ///         live function of vol, so estimates must be refreshable without a
    ///         redeploy when the volatility regime shifts.
    function setVol(address stock, uint256 volWad) external onlyOwner {
        if (!isSupported[stock]) revert NotSupported();
        if (volWad == 0 || volWad > 5e18) revert InvalidRiskParameter();
        vol[stock] = volWad;
        emit VolatilityUpdated(stock, volWad);
    }

    function setCorrelation(address a, address b, int256 rhoWad) external onlyOwner {
        require(isSupported[a] && isSupported[b], "unsupported");
        if (rhoWad < -1e18 || rhoWad > 1e18) revert InvalidRiskParameter();
        if (a == b && rhoWad != 1e18) revert InvalidRiskParameter();
        corr[a][b] = rhoWad;
        corr[b][a] = rhoWad;
        emit CorrelationSet(a, b, rhoWad);
    }

    function setRiskParams(uint256 z, uint256 sqrtT, uint256 safety) external onlyOwner {
        if (z == 0 || z > 10e18 || sqrtT == 0 || sqrtT > 1e18 || safety < 1e18 || safety > 10e18) {
            revert InvalidRiskParameter();
        }
        zScore = z;
        horizonSqrt = sqrtT;
        varSafetyFactor = safety;
        emit RiskParamsUpdated(z, sqrtT, safety);
    }

    function setMaxLtv(uint256 newMaxLtvWad) external onlyOwner {
        if (newMaxLtvWad == 0 || newMaxLtvWad > 0.9e18) revert InvalidRiskParameter();
        maxLtvWad = newMaxLtvWad;
        emit MaxLtvUpdated(newMaxLtvWad);
    }

    function setSigmaCore(ISigmaCore newCore) external onlyOwner {
        if (address(newCore) == address(0) || address(newCore).code.length == 0) {
            revert InvalidAddress();
        }
        sigmaCore = newCore;
    }

    function setOracle(IOracleAdapter newOracle) external onlyOwner {
        if (address(newOracle) == address(0) || address(newOracle).code.length == 0) {
            revert InvalidAddress();
        }
        oracle = newOracle;
    }

    // -- Executor delegation -------------------------------------------------

    /// @notice Designate `newExecutor` as authorized to act on msg.sender's position
    ///         via `*For` variants. Pass `address(0)` to revoke.
    function setExecutor(address newExecutor) external {
        executor[msg.sender] = newExecutor;
        emit ExecutorSet(msg.sender, newExecutor);
    }

    modifier asUser(address user) {
        if (msg.sender != user && msg.sender != executor[user]) revert NotExecutor();
        _;
    }

    // -- User actions --------------------------------------------------------

    function deposit(address stock, uint256 amount) external nonReentrant {
        if (!isSupported[stock]) revert NotSupported();
        if (amount == 0) revert ZeroAmount();
        IERC20(stock).safeTransferFrom(msg.sender, address(this), amount);
        collateral[msg.sender][stock] += amount;
        emit Deposited(msg.sender, stock, amount);
    }

    function withdraw(address stock, uint256 amount) external nonReentrant {
        if (!isSupported[stock]) revert NotSupported();
        if (amount == 0) revert ZeroAmount();
        if (collateral[msg.sender][stock] < amount) revert InsufficientCollateral();
        collateral[msg.sender][stock] -= amount;
        if (debt[msg.sender] > 0 && !_isHealthy(msg.sender)) revert Unhealthy();
        IERC20(stock).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, stock, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        debt[msg.sender] += amount;
        if (!_isHealthy(msg.sender)) revert Unhealthy();
        usdc.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 owed = debt[msg.sender];
        uint256 pay = amount > owed ? owed : amount;
        debt[msg.sender] = owed - pay;
        usdc.safeTransferFrom(msg.sender, address(this), pay);
        emit Repaid(msg.sender, pay);
    }

    /// @notice Seize `seizeAmount` of `seizeStock` from `user` in exchange for
    ///         repaying `repayUsdc` of their debt. Only when `user` is unhealthy.
    // -- Executor-callable variants ------------------------------------------

    /// @notice Borrow on behalf of `user`. USDC is delivered to `user`, not to the executor.
    function borrowFor(address user, uint256 amount) external asUser(user) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        debt[user] += amount;
        if (!_isHealthy(user)) revert Unhealthy();
        usdc.safeTransfer(user, amount);
        emit Borrowed(user, amount);
    }

    /// @notice Repay on behalf of `user`. USDC is pulled from msg.sender.
    function repayFor(address user, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 owed = debt[user];
        uint256 pay = amount > owed ? owed : amount;
        debt[user] = owed - pay;
        usdc.safeTransferFrom(msg.sender, address(this), pay);
        emit Repaid(user, pay);
    }

    /// @notice Withdraw collateral on behalf of `user`. Stock is delivered to `user`.
    function withdrawFor(address user, address stock, uint256 amount) external asUser(user) nonReentrant {
        if (!isSupported[stock]) revert NotSupported();
        if (amount == 0) revert ZeroAmount();
        if (collateral[user][stock] < amount) revert InsufficientCollateral();
        collateral[user][stock] -= amount;
        if (debt[user] > 0 && !_isHealthy(user)) revert Unhealthy();
        IERC20(stock).safeTransfer(user, amount);
        emit Withdrawn(user, stock, amount);
    }

    function liquidate(address user, address seizeStock, uint256 seizeAmount, uint256 repayUsdc) external nonReentrant {
        if (seizeAmount == 0 || repayUsdc == 0) revert ZeroAmount();
        if (_isHealthy(user)) revert Healthy();
        if (!isSupported[seizeStock]) revert NotSupported();
        if (collateral[user][seizeStock] < seizeAmount) revert InsufficientCollateral();

        uint256 owed = debt[user];
        uint256 maxRepay = Math.mulDiv(owed, LIQUIDATION_CLOSE_FACTOR_WAD, WAD, Math.Rounding.Ceil);
        uint256 pay = Math.min(repayUsdc, maxRepay);
        uint256 seizeValue6 = Math.mulDiv(seizeAmount, oracle.getPrice(seizeStock), 1e30, Math.Rounding.Ceil);
        uint256 maxSeizeValue6 = Math.mulDiv(pay, LIQUIDATION_BONUS_WAD, WAD);
        if (seizeValue6 > maxSeizeValue6) revert ExcessiveSeizure();

        debt[user] = owed - pay;
        collateral[user][seizeStock] -= seizeAmount;

        usdc.safeTransferFrom(msg.sender, address(this), pay);
        IERC20(seizeStock).safeTransfer(msg.sender, seizeAmount);
        emit Liquidated(msg.sender, user, seizeStock, pay, seizeAmount);
    }

    // -- Views ---------------------------------------------------------------

    function supportedStocks() external view returns (address[] memory) {
        return stocks;
    }

    /// @notice User's collateral value, USDC 6-dec.
    function portfolioValue(address user) public view returns (uint256 totalUsdc6) {
        uint256 n = stocks.length;
        for (uint256 i = 0; i < n; i++) {
            address s = stocks[i];
            uint256 amt = collateral[user][s];
            if (amt == 0) continue;
            uint256 priceWad = oracle.getPrice(s);
            // amt (1e18) * priceWad (1e18) / 1e30 → 6-decimal USDC.
            totalUsdc6 += (amt * priceWad) / 1e30;
        }
    }

    /// @notice Live VaR for `user`, in USDC 6-dec.
    function computeVaR(address user) public view returns (uint256) {
        uint256 n = stocks.length;
        if (n == 0) return 0;

        uint256[] memory weights = new uint256[](n);
        uint256[] memory vols = new uint256[](n);
        uint256 totalValue6 = 0;

        // First pass: position values + vols.
        uint256[] memory value6 = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            address s = stocks[i];
            uint256 amt = collateral[user][s];
            uint256 v6 = amt == 0 ? 0 : (amt * oracle.getPrice(s)) / 1e30;
            value6[i] = v6;
            totalValue6 += v6;
            vols[i] = vol[s];
        }
        if (totalValue6 == 0) return 0;

        // Second pass: weights in WAD.
        for (uint256 i = 0; i < n; i++) {
            weights[i] = (value6[i] * 1e18) / totalValue6;
        }

        // Pack upper-triangular correlation matrix incl. diagonal.
        uint256 cn = (n * (n + 1)) / 2;
        int256[] memory corrPacked = new int256[](cn);
        uint256 k = 0;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = i; j < n; j++) {
                corrPacked[k++] = corr[stocks[i]][stocks[j]];
            }
        }

        return sigmaCore.computePortfolioVar(weights, vols, corrPacked, totalValue6, zScore, horizonSqrt);
    }

    /// @notice Max USDC the user could borrow at current prices, in 6-dec.
    function maxBorrowable(address user) public view returns (uint256) {
        uint256 pv = portfolioValue(user);
        uint256 var_ = computeVaR(user);
        uint256 safety = (var_ * varSafetyFactor) / 1e18;
        uint256 varBound = pv > safety ? pv - safety : 0;
        uint256 ltvBound = Math.mulDiv(pv, maxLtvWad, WAD);
        return Math.min(varBound, ltvBound);
    }

    /// @notice Health factor in WAD: maxBorrowable / debt. >1e18 means healthy.
    function health(address user) public view returns (uint256) {
        uint256 d = debt[user];
        if (d == 0) return type(uint256).max;
        return (maxBorrowable(user) * 1e18) / d;
    }

    function _isHealthy(address user) internal view returns (bool) {
        return health(user) >= 1e18;
    }
}
