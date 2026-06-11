// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {SigmaVault} from "../src/SigmaVault.sol";
import {MockRHStock} from "../src/MockRHStock.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {IOracleAdapter} from "../src/IOracleAdapter.sol";
import {ISigmaCore} from "../src/ISigmaCore.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockSigmaCore} from "./mocks/MockSigmaCore.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SigmaVaultTest is Test {
    SigmaVault vault;
    MockRHStock aapl;
    MockRHStock tsla;
    MockOracle oracle;
    MockSigmaCore core;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC();
        core = new MockSigmaCore();
        oracle = new MockOracle(owner);
        aapl = new MockRHStock("RH AAPL", "rAAPL", owner);
        tsla = new MockRHStock("RH TSLA", "rTSLA", owner);

        vault = new SigmaVault(IERC20(address(usdc)), ISigmaCore(address(core)), IOracleAdapter(address(oracle)), owner);

        // 20% and 30% annualized vol respectively.
        vault.addStock(address(aapl), 0.2e18);
        vault.addStock(address(tsla), 0.3e18);
        vault.setCorrelation(address(aapl), address(tsla), 0.5e18);

        // Prices: $200 AAPL, $250 TSLA (WAD-scaled USDC per token).
        oracle.setPrice(address(aapl), 200e18);
        oracle.setPrice(address(tsla), 250e18);

        // Seed vault with USDC so borrows can pay out.
        usdc.mint(address(vault), 10_000_000e6);

        vm.stopPrank();
    }

    function _mint(MockRHStock token, address to, uint256 amount) internal {
        vm.prank(owner);
        token.mint(to, amount);
    }

    function test_deposit_increases_portfolio_value() public {
        _mint(aapl, alice, 100e18); // 100 shares
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        vm.stopPrank();

        // 100 * 200 = $20,000 → 20_000e6 in USDC 6-dec.
        assertEq(vault.portfolioValue(alice), 20_000e6);
    }

    function test_borrow_within_limit_succeeds() public {
        _mint(aapl, alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);

        // Mock VaR = $1,000 → 1_000e6. Safety factor 2x → buffer 2_000e6.
        vm.stopPrank();
        vm.prank(owner);
        core.setVar(1_000e6);

        // VaR allows $18k, but the independent 80% base-LTV cap limits this to $16k.
        assertEq(vault.maxBorrowable(alice), 16_000e6);

        vm.prank(alice);
        vault.borrow(15_000e6);
        assertEq(usdc.balanceOf(alice), 15_000e6);
        assertGt(vault.health(alice), 1e18);
    }

    function test_borrow_above_limit_reverts() public {
        _mint(aapl, alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        vm.stopPrank();

        vm.prank(owner);
        core.setVar(1_000e6);

        vm.prank(alice);
        vm.expectRevert(SigmaVault.Unhealthy.selector);
        vault.borrow(19_000e6); // > 18k cap
    }

    function test_repay_restores_health() public {
        _mint(aapl, alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        vm.stopPrank();

        vm.prank(owner);
        core.setVar(1_000e6);

        vm.prank(alice);
        vault.borrow(15_000e6);

        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.repay(15_000e6);
        vm.stopPrank();

        assertEq(vault.debt(alice), 0);
    }

    function test_liquidation_after_var_spike() public {
        _mint(aapl, alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        vm.stopPrank();

        vm.prank(owner);
        core.setVar(1_000e6);

        vm.prank(alice);
        vault.borrow(15_000e6);

        // VaR triples — position is now unhealthy.
        vm.prank(owner);
        core.setVar(8_000e6); // 2x safety → 16k buffer, pv=20k → max=4k < debt=15k.

        // Bob liquidates: repays 5k USDC, seizes 25 AAPL ($5,000 worth).
        vm.prank(owner);
        usdc.mint(bob, 5_000e6);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.liquidate(alice, address(aapl), 25e18, 5_000e6);
        vm.stopPrank();

        assertEq(vault.debt(alice), 10_000e6);
        assertEq(aapl.balanceOf(bob), 25e18);
    }

    function test_liquidation_cannot_seize_collateral_for_zero_repayment() public {
        _makeAliceUnhealthy();

        vm.prank(bob);
        vm.expectRevert(SigmaVault.ZeroAmount.selector);
        vault.liquidate(alice, address(aapl), 25e18, 0);
    }

    function test_liquidation_rejects_value_above_bonus() public {
        _makeAliceUnhealthy();
        vm.prank(owner);
        usdc.mint(bob, 5_000e6);

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert(SigmaVault.ExcessiveSeizure.selector);
        vault.liquidate(alice, address(aapl), 30e18, 5_000e6);
        vm.stopPrank();
    }

    function test_liquidation_caps_repayment_at_close_factor() public {
        _makeAliceUnhealthy();
        vm.prank(owner);
        usdc.mint(bob, 10_000e6);

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.liquidate(alice, address(aapl), 37.5e18, 10_000e6);
        vm.stopPrank();

        assertEq(vault.debt(alice), 7_500e6);
        assertEq(usdc.balanceOf(bob), 2_500e6);
    }

    function test_invalid_correlation_reverts() public {
        vm.prank(owner);
        vm.expectRevert(SigmaVault.InvalidRiskParameter.selector);
        vault.setCorrelation(address(aapl), address(tsla), 1.01e18);
    }

    function test_setVol_updates_supported_stock() public {
        vm.prank(owner);
        vault.setVol(address(aapl), 0.6e18);
        assertEq(vault.vol(address(aapl)), 0.6e18);
    }

    function test_setVol_rejects_unsupported_stock_and_bad_bounds() public {
        vm.startPrank(owner);
        vm.expectRevert(SigmaVault.NotSupported.selector);
        vault.setVol(makeAddr("unsupported"), 0.5e18);
        vm.expectRevert(SigmaVault.InvalidRiskParameter.selector);
        vault.setVol(address(aapl), 0);
        vm.expectRevert(SigmaVault.InvalidRiskParameter.selector);
        vault.setVol(address(aapl), 5e18 + 1);
        vm.stopPrank();
    }

    function test_setVol_rejects_non_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setVol(address(aapl), 0.6e18);
    }

    function testFuzz_successfulBorrowAlwaysLeavesPositionHealthy(uint96 collateralAmount, uint96 borrowAmount) public {
        uint256 shares = bound(uint256(collateralAmount), 1e18, 10_000e18);
        _mint(aapl, alice, shares);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), shares);
        vm.stopPrank();

        vm.prank(owner);
        core.setVar(0);
        uint256 limit = vault.maxBorrowable(alice);
        uint256 amount = bound(uint256(borrowAmount), 1, limit);

        vm.prank(alice);
        vault.borrow(amount);
        assertGe(vault.health(alice), 1e18);
        assertLe(vault.debt(alice), vault.maxBorrowable(alice));
    }

    function testFuzz_liquidationNeverSeizesAboveConfiguredBonus(uint96 requestedRepay) public {
        _makeAliceUnhealthy();
        uint256 repay = bound(uint256(requestedRepay), 1e6, 7_500e6);
        uint256 maxSeizeValue6 = (repay * vault.LIQUIDATION_BONUS_WAD()) / 1e18;
        uint256 seizeAmount = (maxSeizeValue6 * 1e30) / 200e18;

        vm.prank(owner);
        usdc.mint(bob, repay);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.liquidate(alice, address(aapl), seizeAmount, repay);
        vm.stopPrank();

        uint256 seizedValue6 = (seizeAmount * oracle.getPrice(address(aapl))) / 1e30;
        assertLe(seizedValue6, maxSeizeValue6);
    }

    function _makeAliceUnhealthy() internal {
        _mint(aapl, alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        vm.stopPrank();

        vm.prank(owner);
        core.setVar(1_000e6);
        vm.prank(alice);
        vault.borrow(15_000e6);

        vm.prank(owner);
        core.setVar(8_000e6);
    }
}
