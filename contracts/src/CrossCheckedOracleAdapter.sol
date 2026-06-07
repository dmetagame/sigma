// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IOracleAdapter} from "./IOracleAdapter.sol";

/// @title CrossCheckedOracleAdapter
/// @notice Stores timestamped equity prices submitted by a dedicated reporter.
///         The reporter is expected to publish only after independent upstream
///         sources agree. On-chain freshness, monotonicity, and deviation
///         limits contain reporter or upstream failures.
/// @dev The owner can rotate the reporter and tune guardrails but cannot set a
///      price directly. This separation prevents the Vault owner from silently
///      overriding collateral values.
contract CrossCheckedOracleAdapter is IOracleAdapter, Ownable2Step {
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_STALENESS_LIMIT = 7 days;
    uint256 public constant MAX_DEVIATION_LIMIT_BPS = 5_000;

    struct PriceData {
        uint192 priceWad;
        uint64 observedAt;
    }

    mapping(address stock => PriceData data) public priceOf;
    mapping(address stock => bytes32 evidenceHash) public evidenceOf;

    address public reporter;
    uint256 public maxStaleness = 4 days;
    uint256 public maxDeviationBps = 2_500;
    bool public paused;

    event ReporterSet(address indexed previousReporter, address indexed newReporter);
    event PriceUpdated(address indexed stock, uint256 priceWad, uint64 observedAt, bytes32 evidenceHash);
    event MaxStalenessSet(uint256 maxStaleness);
    event MaxDeviationSet(uint256 maxDeviationBps);
    event PauseSet(bool paused);

    error NotReporter();
    error InvalidParameter();
    error InvalidLength();
    error InvalidTimestamp();
    error NonMonotonicTimestamp();
    error ExcessiveDeviation();
    error StalePrice();
    error NoPrice();
    error Paused();

    constructor(address initialOwner, address initialReporter) Ownable(initialOwner) {
        if (initialReporter == address(0)) revert InvalidParameter();
        reporter = initialReporter;
        emit ReporterSet(address(0), initialReporter);
    }

    modifier onlyReporter() {
        if (msg.sender != reporter) revert NotReporter();
        _;
    }

    function setReporter(address newReporter) external onlyOwner {
        if (newReporter == address(0)) revert InvalidParameter();
        address previous = reporter;
        reporter = newReporter;
        emit ReporterSet(previous, newReporter);
    }

    function setMaxStaleness(uint256 newMaxStaleness) external onlyOwner {
        if (newMaxStaleness == 0 || newMaxStaleness > MAX_STALENESS_LIMIT) revert InvalidParameter();
        maxStaleness = newMaxStaleness;
        emit MaxStalenessSet(newMaxStaleness);
    }

    function setMaxDeviationBps(uint256 newMaxDeviationBps) external onlyOwner {
        if (newMaxDeviationBps == 0 || newMaxDeviationBps > MAX_DEVIATION_LIMIT_BPS) {
            revert InvalidParameter();
        }
        maxDeviationBps = newMaxDeviationBps;
        emit MaxDeviationSet(newMaxDeviationBps);
    }

    function setPaused(bool newPaused) external onlyOwner {
        paused = newPaused;
        emit PauseSet(newPaused);
    }

    function updatePrices(
        address[] calldata stocks,
        uint256[] calldata pricesWad,
        uint64[] calldata observedAts,
        bytes32[] calldata evidenceHashes
    ) external onlyReporter {
        uint256 length = stocks.length;
        if (
            length == 0 || pricesWad.length != length || observedAts.length != length || evidenceHashes.length != length
        ) {
            revert InvalidLength();
        }

        for (uint256 i = 0; i < length; i++) {
            address stock = stocks[i];
            uint256 priceWad = pricesWad[i];
            uint64 observedAt = observedAts[i];
            if (stock == address(0) || priceWad == 0 || priceWad > type(uint192).max || evidenceHashes[i] == bytes32(0))
            {
                revert InvalidParameter();
            }
            if (observedAt > block.timestamp || block.timestamp - observedAt > maxStaleness) {
                revert InvalidTimestamp();
            }

            PriceData memory previous = priceOf[stock];
            if (previous.observedAt != 0) {
                if (observedAt <= previous.observedAt) revert NonMonotonicTimestamp();
                uint256 difference = Math.max(priceWad, previous.priceWad) - Math.min(priceWad, previous.priceWad);
                uint256 deviationBps = Math.mulDiv(difference, BPS, previous.priceWad, Math.Rounding.Ceil);
                if (deviationBps > maxDeviationBps) revert ExcessiveDeviation();
            }

            priceOf[stock] = PriceData({priceWad: uint192(priceWad), observedAt: observedAt});
            evidenceOf[stock] = evidenceHashes[i];
            emit PriceUpdated(stock, priceWad, observedAt, evidenceHashes[i]);
        }
    }

    function getPrice(address stock) external view returns (uint256) {
        if (paused) revert Paused();
        PriceData memory data = priceOf[stock];
        if (data.priceWad == 0) revert NoPrice();
        if (data.observedAt > block.timestamp || block.timestamp - data.observedAt > maxStaleness) revert StalePrice();
        return data.priceWad;
    }
}
