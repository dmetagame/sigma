// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {CrossCheckedOracleAdapter} from "../src/CrossCheckedOracleAdapter.sol";

contract CrossCheckedOracleAdapterTest is Test {
    CrossCheckedOracleAdapter adapter;
    address owner = makeAddr("owner");
    address reporter = makeAddr("reporter");
    address outsider = makeAddr("outsider");
    address stock = makeAddr("stock");

    function setUp() public {
        vm.warp(10 days);
        adapter = new CrossCheckedOracleAdapter(owner, reporter);
    }

    function _update(uint256 price, uint64 observedAt) internal {
        address[] memory stocks = new address[](1);
        uint256[] memory prices = new uint256[](1);
        uint64[] memory observedAts = new uint64[](1);
        bytes32[] memory evidence = new bytes32[](1);
        stocks[0] = stock;
        prices[0] = price;
        observedAts[0] = observedAt;
        evidence[0] = keccak256(abi.encode(price, observedAt));
        vm.prank(reporter);
        adapter.updatePrices(stocks, prices, observedAts, evidence);
    }

    function test_reporter_updates_fresh_price() public {
        _update(200e18, uint64(block.timestamp));
        assertEq(adapter.getPrice(stock), 200e18);
    }

    function test_non_reporter_cannot_update() public {
        address[] memory stocks = new address[](1);
        uint256[] memory prices = new uint256[](1);
        uint64[] memory observedAts = new uint64[](1);
        bytes32[] memory evidence = new bytes32[](1);
        stocks[0] = stock;
        prices[0] = 200e18;
        observedAts[0] = uint64(block.timestamp);
        evidence[0] = keccak256("evidence");

        vm.prank(outsider);
        vm.expectRevert(CrossCheckedOracleAdapter.NotReporter.selector);
        adapter.updatePrices(stocks, prices, observedAts, evidence);
    }

    function test_owner_cannot_set_price() public view {
        assertEq(adapter.reporter(), reporter);
        assertEq(adapter.owner(), owner);
    }

    function test_rejects_stale_submission() public {
        vm.prank(owner);
        adapter.setMaxStaleness(1 days);
        vm.expectRevert(CrossCheckedOracleAdapter.InvalidTimestamp.selector);
        _update(200e18, uint64(block.timestamp - 1 days - 1));
    }

    function test_rejects_non_monotonic_timestamp() public {
        uint64 timestamp = uint64(block.timestamp - 1);
        _update(200e18, timestamp);
        vm.expectRevert(CrossCheckedOracleAdapter.NonMonotonicTimestamp.selector);
        _update(201e18, timestamp);
    }

    function test_rejects_excessive_price_jump() public {
        _update(200e18, uint64(block.timestamp - 2));
        vm.expectRevert(CrossCheckedOracleAdapter.ExcessiveDeviation.selector);
        _update(260e18, uint64(block.timestamp - 1));
    }

    function test_price_expires() public {
        vm.prank(owner);
        adapter.setMaxStaleness(1 hours);
        _update(200e18, uint64(block.timestamp));
        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert(CrossCheckedOracleAdapter.StalePrice.selector);
        adapter.getPrice(stock);
    }

    function test_pause_blocks_reads() public {
        _update(200e18, uint64(block.timestamp));
        vm.prank(owner);
        adapter.setPaused(true);
        vm.expectRevert(CrossCheckedOracleAdapter.Paused.selector);
        adapter.getPrice(stock);
    }
}
