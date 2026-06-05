// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleAdapter} from "./IOracleAdapter.sol";

// Minimal Chainlink AggregatorV3 interface — inlined to avoid a submodule.
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals() external view returns (uint8);
}

/// @notice OracleAdapter that wraps Chainlink price feeds. Returns USDC-per-token
///         scaled to 1e18 (WAD). If a feed isn't set for a stock, falls back to a
///         manipulable price set by the owner — same surface as MockOracle so the
///         demo can mix live feeds and stress-test overrides.
contract ChainlinkOracleAdapter is IOracleAdapter, Ownable {
    mapping(address => AggregatorV3Interface) public feedOf;
    mapping(address => uint256) public fallbackWad;

    event FeedSet(address indexed stock, address feed);
    event FallbackPriceSet(address indexed stock, uint256 priceWad);

    error StalePrice();
    error NoPrice();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setFeed(address stock, AggregatorV3Interface feed) external onlyOwner {
        feedOf[stock] = feed;
        emit FeedSet(stock, address(feed));
    }

    function setFallback(address stock, uint256 priceWad) external onlyOwner {
        fallbackWad[stock] = priceWad;
        emit FallbackPriceSet(stock, priceWad);
    }

    function getPrice(address stock) external view returns (uint256) {
        AggregatorV3Interface feed = feedOf[stock];
        if (address(feed) != address(0)) {
            (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
            if (answer <= 0) revert NoPrice();
            // Skip aggressive staleness checks for testnet; production should
            // enforce updatedAt >= block.timestamp - maxStaleness.
            updatedAt; // silence unused-variable lint
            uint8 dec = feed.decimals();
            uint256 raw = uint256(answer);
            if (dec < 18) return raw * (10 ** (18 - dec));
            if (dec > 18) return raw / (10 ** (dec - 18));
            return raw;
        }
        uint256 fb = fallbackWad[stock];
        if (fb == 0) revert NoPrice();
        return fb;
    }
}
