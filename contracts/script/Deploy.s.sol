// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SigmaVault} from "../src/SigmaVault.sol";
import {SigmaStrategist} from "../src/SigmaStrategist.sol";
import {ChainlinkOracleAdapter} from "../src/ChainlinkOracleAdapter.sol";
import {IOracleAdapter} from "../src/IOracleAdapter.sol";
import {ISigmaCore} from "../src/ISigmaCore.sol";

/// @notice Deploys the Solidity layer of Sigma to a target chain (default:
///         Robinhood Chain testnet, ID 46630). Uses the real on-chain stock
///         tokens + USDC discovered on the explorer; the Stylus Core address
///         must be passed via SIGMA_CORE_ADDR (deploy core first via
///         `cargo stylus deploy`).
///
/// Environment
/// -----------
/// - DEPLOYER_PRIVATE_KEY      (required) hex private key, 0x-prefixed
/// - SIGMA_CORE_ADDR           (required) address of the deployed Stylus
///                              contract — set this AFTER cargo stylus deploy
/// - USDC_ADDR                 default Ac80194d...290fe0 (6-dec real USDC)
/// - STOCK_TSLA_ADDR / AMD / AMZN / NFLX / PLTR  default to RH testnet addresses
///
/// Run
/// ---
///     forge script script/Deploy.s.sol:Deploy \
///         --rpc-url rh_testnet \
///         --broadcast \
///         --slow
contract Deploy is Script {
    // Defaults — Robinhood Chain testnet, discovered via Blockscout API.
    address constant DEFAULT_USDC = 0xAc80194dc1aE8eF52df73e7e1864fB3C62290fe0;
    address constant DEFAULT_TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address constant DEFAULT_AMD = 0x71178BAc73cBeb415514eB542a8995b82669778d;
    address constant DEFAULT_AMZN = 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02;
    address constant DEFAULT_NFLX = 0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93;
    address constant DEFAULT_PLTR = 0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0;

    struct StockSpec {
        address addr;
        string symbol;
        uint256 volWad; // annualized
        uint256 priceWad; // USDC-denominated, fallback for oracle adapter
    }

    function run() external returns (address vault, address strategist, address oracle) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address coreAddr = vm.envAddress("SIGMA_CORE_ADDR");

        address usdc = _envOr("USDC_ADDR", DEFAULT_USDC);
        address tsla = _envOr("STOCK_TSLA_ADDR", DEFAULT_TSLA);
        address amd = _envOr("STOCK_AMD_ADDR", DEFAULT_AMD);
        address amzn = _envOr("STOCK_AMZN_ADDR", DEFAULT_AMZN);
        address nflx = _envOr("STOCK_NFLX_ADDR", DEFAULT_NFLX);
        address pltr = _envOr("STOCK_PLTR_ADDR", DEFAULT_PLTR);

        StockSpec[5] memory stocks = [
            StockSpec(tsla, "TSLA", 0.45e18, 280e18),
            StockSpec(amd, "AMD", 0.5e18, 165e18),
            StockSpec(amzn, "AMZN", 0.32e18, 195e18),
            StockSpec(nflx, "NFLX", 0.4e18, 660e18),
            StockSpec(pltr, "PLTR", 0.65e18, 145e18)
        ];

        address deployer = vm.addr(pk);
        console.log("Deployer:", deployer);
        console.log("Sigma Core (Stylus):", coreAddr);
        console.log("USDC:", usdc);

        vm.startBroadcast(pk);

        // 1. Oracle adapter with fallback prices baked in for the demo.
        ChainlinkOracleAdapter oracleAdapter = new ChainlinkOracleAdapter(deployer);
        for (uint256 i = 0; i < stocks.length; i++) {
            oracleAdapter.setFallback(stocks[i].addr, stocks[i].priceWad);
            console.log("Seeded fallback price for", stocks[i].symbol);
        }

        // 2. Vault wired to Stylus Core + USDC + oracle.
        SigmaVault sv =
            new SigmaVault(IERC20(usdc), ISigmaCore(coreAddr), IOracleAdapter(address(oracleAdapter)), deployer);
        console.log("SigmaVault:", address(sv));

        // 3. Register supported stocks with annualized vols.
        for (uint256 i = 0; i < stocks.length; i++) {
            sv.addStock(stocks[i].addr, stocks[i].volWad);
        }

        // 4. Pairwise correlations — coarse seed; refine via governance later.
        //    Tech-heavy basket → meaningful positive cross-correlations.
        _setPairs(sv, stocks);

        // 5. Strategist on top of the vault.
        SigmaStrategist strat = new SigmaStrategist(sv);
        console.log("SigmaStrategist:", address(strat));

        vm.stopBroadcast();

        vault = address(sv);
        strategist = address(strat);
        oracle = address(oracleAdapter);

        _writeDeployment(coreAddr, vault, strategist, oracle, usdc, stocks);
    }

    function _setPairs(SigmaVault sv, StockSpec[5] memory s) internal {
        // Hand-tuned tech-basket correlations. Numbers below are illustrative
        // for the demo; replace with rolling-window estimates pre-mainnet.
        sv.setCorrelation(s[0].addr, s[1].addr, 0.55e18); // TSLA-AMD
        sv.setCorrelation(s[0].addr, s[2].addr, 0.4e18); // TSLA-AMZN
        sv.setCorrelation(s[0].addr, s[3].addr, 0.35e18); // TSLA-NFLX
        sv.setCorrelation(s[0].addr, s[4].addr, 0.6e18); // TSLA-PLTR
        sv.setCorrelation(s[1].addr, s[2].addr, 0.5e18); // AMD-AMZN
        sv.setCorrelation(s[1].addr, s[3].addr, 0.45e18); // AMD-NFLX
        sv.setCorrelation(s[1].addr, s[4].addr, 0.55e18); // AMD-PLTR
        sv.setCorrelation(s[2].addr, s[3].addr, 0.55e18); // AMZN-NFLX
        sv.setCorrelation(s[2].addr, s[4].addr, 0.4e18); // AMZN-PLTR
        sv.setCorrelation(s[3].addr, s[4].addr, 0.4e18); // NFLX-PLTR
    }

    function _envOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address v) {
            return v == address(0) ? fallback_ : v;
        } catch {
            return fallback_;
        }
    }

    function _writeDeployment(
        address core,
        address vault_,
        address strat_,
        address oracle_,
        address usdc_,
        StockSpec[5] memory s
    ) internal {
        string memory j = string.concat(
            "{\n",
            '  "chainId": 46630,\n',
            '  "sigmaCore": "',
            vm.toString(core),
            '",\n',
            '  "sigmaVault": "',
            vm.toString(vault_),
            '",\n',
            '  "sigmaStrategist": "',
            vm.toString(strat_),
            '",\n',
            '  "oracleAdapter": "',
            vm.toString(oracle_),
            '",\n',
            '  "usdc": "',
            vm.toString(usdc_),
            '",\n',
            '  "stocks": [\n'
        );
        for (uint256 i = 0; i < s.length; i++) {
            j = string.concat(
                j,
                '    { "symbol": "',
                s[i].symbol,
                '", "address": "',
                vm.toString(s[i].addr),
                '" }',
                i == s.length - 1 ? "\n" : ",\n"
            );
        }
        j = string.concat(j, "  ]\n}\n");
        vm.writeFile("deployments/rh-testnet.json", j);
        console.log("Wrote deployments/rh-testnet.json");
    }
}
