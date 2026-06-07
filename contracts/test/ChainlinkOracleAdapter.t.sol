// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ChainlinkOracleAdapter} from "../src/ChainlinkOracleAdapter.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract ChainlinkOracleAdapterTest is Test {
    ChainlinkOracleAdapter adapter;
    MockAggregator feed;
    address stock = makeAddr("stock");

    function setUp() public {
        vm.warp(10 days);
        adapter = new ChainlinkOracleAdapter(address(this));
        feed = new MockAggregator(8);
        adapter.setFeed(stock, feed);
    }

    function test_scales_fresh_feed_to_wad() public {
        feed.setRound(10, 200e8, block.timestamp, 10);
        assertEq(adapter.getPrice(stock), 200e18);
    }

    function test_rejects_stale_feed() public {
        feed.setRound(10, 200e8, block.timestamp - 1 days - 1, 10);
        vm.expectRevert(ChainlinkOracleAdapter.StalePrice.selector);
        adapter.getPrice(stock);
    }

    function test_rejects_incomplete_round() public {
        feed.setRound(10, 200e8, block.timestamp, 9);
        vm.expectRevert(ChainlinkOracleAdapter.StalePrice.selector);
        adapter.getPrice(stock);
    }

    function test_uses_explicit_fallback_without_feed() public {
        address fallbackStock = makeAddr("fallbackStock");
        adapter.setFallback(fallbackStock, 123e18);
        assertEq(adapter.getPrice(fallbackStock), 123e18);
    }
}
