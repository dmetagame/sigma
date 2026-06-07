// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {SigmaVault} from "../src/SigmaVault.sol";
import {SigmaStrategist} from "../src/SigmaStrategist.sol";
import {MockRHStock} from "../src/MockRHStock.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {IOracleAdapter} from "../src/IOracleAdapter.sol";
import {ISigmaCore} from "../src/ISigmaCore.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockSigmaCore} from "./mocks/MockSigmaCore.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SigmaStrategistTest is Test {
    SigmaVault vault;
    SigmaStrategist strategist;
    MockRHStock aapl;
    MockOracle oracle;
    MockSigmaCore core;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address pilot = makeAddr("pilot");
    address rando = makeAddr("rando");

    SigmaStrategist.Policy basePolicy;

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        core = new MockSigmaCore();
        oracle = new MockOracle(owner);
        aapl = new MockRHStock("RH AAPL", "rAAPL", owner);
        vault = new SigmaVault(IERC20(address(usdc)), ISigmaCore(address(core)), IOracleAdapter(address(oracle)), owner);
        strategist = new SigmaStrategist(vault);

        vault.addStock(address(aapl), 0.2e18);
        oracle.setPrice(address(aapl), 200e18);
        usdc.mint(address(vault), 10_000_000e6);
        vm.stopPrank();

        // Alice deposits collateral.
        vm.prank(owner);
        aapl.mint(alice, 100e18);
        vm.startPrank(alice);
        aapl.approve(address(vault), type(uint256).max);
        vault.deposit(address(aapl), 100e18);
        // Designate strategist as Vault executor for alice.
        vault.setExecutor(address(strategist));
        vm.stopPrank();

        // Mock VaR small enough that we have borrow room.
        vm.prank(owner);
        core.setVar(500e6);

        basePolicy = SigmaStrategist.Policy({
            agent: pilot,
            maxBorrow6: 10_000e6,
            maxStockShare: 1e18,
            minHealthFactor: 1.2e18,
            cooldownSec: 60,
            active: true
        });
    }

    function _register(SigmaStrategist.Policy memory p) internal {
        vm.prank(alice);
        strategist.register(p);
    }

    function test_register_and_borrow_via_agent() public {
        _register(basePolicy);

        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(5_000e6)), "test borrow");

        assertEq(vault.debt(alice), 5_000e6);
        assertEq(usdc.balanceOf(alice), 5_000e6);
    }

    function test_non_agent_cannot_execute() public {
        _register(basePolicy);

        vm.prank(rando);
        vm.expectRevert(SigmaStrategist.NotAgent.selector);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(1_000e6)), "should fail");
    }

    function test_borrow_above_policy_cap_reverts() public {
        _register(basePolicy);

        vm.prank(pilot);
        vm.expectRevert(SigmaStrategist.BorrowCapExceeded.selector);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(15_000e6)), "over cap");
    }

    function test_register_rejects_stock_share_above_one() public {
        SigmaStrategist.Policy memory invalid = basePolicy;
        invalid.maxStockShare = 1e18 + 1;

        vm.prank(alice);
        vm.expectRevert(SigmaStrategist.InvalidPolicy.selector);
        strategist.register(invalid);
    }

    function test_cooldown_blocks_back_to_back_actions() public {
        _register(basePolicy);

        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(1_000e6)), "first");

        vm.prank(pilot);
        vm.expectRevert(SigmaStrategist.Cooldown.selector);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(1_000e6)), "too soon");

        // After cooldown — succeeds.
        vm.warp(block.timestamp + 61);
        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(1_000e6)), "after cd");
        assertEq(vault.debt(alice), 2_000e6);
    }

    function test_repay_via_agent_pulls_user_usdc() public {
        _register(basePolicy);

        // Borrow first.
        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(5_000e6)), "borrow");

        vm.warp(block.timestamp + 61);

        // Alice approves Strategist for USDC.
        vm.prank(alice);
        usdc.approve(address(strategist), type(uint256).max);

        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Repay, abi.encode(uint256(5_000e6)), "deleverage");
        assertEq(vault.debt(alice), 0);
    }

    function test_repay_above_debt_does_not_trap_excess_usdc() public {
        _register(basePolicy);

        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(5_000e6)), "borrow");
        vm.warp(block.timestamp + 61);

        vm.prank(owner);
        usdc.mint(alice, 5_000e6);
        vm.prank(alice);
        usdc.approve(address(strategist), type(uint256).max);

        vm.prank(pilot);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Repay, abi.encode(uint256(10_000e6)), "repay debt");

        assertEq(vault.debt(alice), 0);
        assertEq(usdc.balanceOf(alice), 5_000e6);
        assertEq(usdc.balanceOf(address(strategist)), 0);
    }

    function test_deactivate_locks_agent_out() public {
        _register(basePolicy);

        vm.prank(alice);
        strategist.deactivate();

        vm.prank(pilot);
        vm.expectRevert(SigmaStrategist.PolicyInactive.selector);
        strategist.executeAction(alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(1_000e6)), "blocked");
    }

    function test_post_action_health_check_enforced() public {
        // Tighten policy: minHealthFactor = 5e18 (very strict).
        SigmaStrategist.Policy memory strict = basePolicy;
        strict.minHealthFactor = 5e18;
        _register(strict);

        // Mock VaR larger so post-borrow health is < 5x.
        vm.prank(owner);
        core.setVar(2_000e6);

        vm.prank(pilot);
        vm.expectRevert(SigmaStrategist.HealthBelowMin.selector);
        strategist.executeAction(
            alice, SigmaStrategist.ActionType.Borrow, abi.encode(uint256(8_000e6)), "too aggressive"
        );
    }
}
