// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SigmaVault} from "./SigmaVault.sol";

/// @title SigmaStrategist
/// @notice Agent-bound policy executor. Users register a Policy designating a
///         single agent EOA and on-chain guardrails; the agent submits proposed
///         actions which the Strategist validates against the Policy before
///         forwarding to the Vault. Rationale strings are emitted on-chain so
///         every decision has an auditable receipt.
///
/// @dev Setup flow (per user):
///   1. SigmaVault.setExecutor(strategist) — authorize this contract on the Vault.
///   2. Strategist.register(policy)        — define agent + guardrails.
///   3. (For Repay actions) approve Strategist on USDC.
contract SigmaStrategist is ReentrancyGuard {
    using SafeERC20 for IERC20;

    SigmaVault public immutable vault;
    IERC20 public immutable usdc;

    enum ActionType {
        Borrow, // data: abi.encode(uint256 amount)
        Repay, // data: abi.encode(uint256 amount); pulls USDC from user
        Withdraw // data: abi.encode(address stock, uint256 amount)
    }

    struct Policy {
        address agent; // sole authorized EOA
        uint256 maxBorrow6; // USDC 6-dec hard cap on outstanding debt
        uint256 maxStockShare; // WAD; max share of one stock in portfolio value
        uint256 minHealthFactor; // WAD; post-action health must meet/exceed this
        uint256 cooldownSec; // seconds between actions
        bool active;
    }

    mapping(address => Policy) public policyOf;
    mapping(address => uint256) public lastActionAt;

    event PolicyRegistered(address indexed user, address indexed agent);
    event PolicyDeactivated(address indexed user);
    event ActionExecuted(
        address indexed user, address indexed agent, ActionType indexed action, bytes data, string rationale
    );

    error NotAgent();
    error PolicyInactive();
    error Cooldown();
    error BorrowCapExceeded();
    error ConcentrationExceeded();
    error HealthBelowMin();
    error UnsupportedAction();

    constructor(SigmaVault _vault) {
        vault = _vault;
        usdc = _vault.usdc();
    }

    // -- User wiring ---------------------------------------------------------

    function register(Policy calldata p) external {
        require(p.agent != address(0), "agent=0");
        require(p.minHealthFactor >= 1e18, "minHF<1");
        policyOf[msg.sender] = Policy({
            agent: p.agent,
            maxBorrow6: p.maxBorrow6,
            maxStockShare: p.maxStockShare,
            minHealthFactor: p.minHealthFactor,
            cooldownSec: p.cooldownSec,
            active: true
        });
        emit PolicyRegistered(msg.sender, p.agent);
    }

    function deactivate() external {
        policyOf[msg.sender].active = false;
        emit PolicyDeactivated(msg.sender);
    }

    // -- Agent-callable entry ------------------------------------------------

    /// @notice Execute a policy-bound action on `user`'s position.
    /// @param user       The account whose position is being acted on.
    /// @param action     One of: Borrow, Repay, Withdraw.
    /// @param data       ABI-encoded action parameters.
    /// @param rationale  Free-form decision rationale; emitted on-chain.
    function executeAction(address user, ActionType action, bytes calldata data, string calldata rationale)
        external
        nonReentrant
    {
        Policy memory p = policyOf[user];
        if (!p.active) revert PolicyInactive();
        if (msg.sender != p.agent) revert NotAgent();
        uint256 last = lastActionAt[user];
        if (last != 0 && block.timestamp < last + p.cooldownSec) revert Cooldown();

        if (action == ActionType.Borrow) {
            uint256 amount = abi.decode(data, (uint256));
            uint256 newDebt = vault.debt(user) + amount;
            if (newDebt > p.maxBorrow6) revert BorrowCapExceeded();
            vault.borrowFor(user, amount);
        } else if (action == ActionType.Repay) {
            uint256 amount = abi.decode(data, (uint256));
            usdc.safeTransferFrom(user, address(this), amount);
            usdc.forceApprove(address(vault), amount);
            vault.repayFor(user, amount);
        } else if (action == ActionType.Withdraw) {
            (address stock, uint256 amount) = abi.decode(data, (address, uint256));
            vault.withdrawFor(user, stock, amount);
        } else {
            revert UnsupportedAction();
        }

        // Post-condition checks based on policy.
        if (vault.debt(user) > 0 && vault.health(user) < p.minHealthFactor) {
            revert HealthBelowMin();
        }
        _enforceConcentration(user, p.maxStockShare);

        lastActionAt[user] = block.timestamp;
        emit ActionExecuted(user, msg.sender, action, data, rationale);
    }

    // -- Internal ------------------------------------------------------------

    function _enforceConcentration(address user, uint256 maxShare) internal view {
        if (maxShare == 0 || maxShare >= 1e18) return;
        uint256 pv = vault.portfolioValue(user);
        if (pv == 0) return;
        address[] memory stocks = vault.supportedStocks();
        for (uint256 i = 0; i < stocks.length; i++) {
            uint256 amt = vault.collateral(user, stocks[i]);
            if (amt == 0) continue;
            uint256 v6 = (amt * vault.oracle().getPrice(stocks[i])) / 1e30;
            uint256 share = (v6 * 1e18) / pv;
            if (share > maxShare) revert ConcentrationExceeded();
        }
    }
}
