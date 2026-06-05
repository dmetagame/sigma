// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleAdapter} from "./IOracleAdapter.sol";

/// @title MockOracle
/// @notice Manipulable oracle for demo stress-tests. Owner-only setPrice lets the
///         frontend bump prices to show margin recompute live.
contract MockOracle is IOracleAdapter, Ownable {
    mapping(address => uint256) private _price;

    event PriceUpdated(address indexed stock, uint256 priceWad);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function getPrice(address stock) external view returns (uint256) {
        return _price[stock];
    }

    function setPrice(address stock, uint256 priceWad) external onlyOwner {
        _price[stock] = priceWad;
        emit PriceUpdated(stock, priceWad);
    }
}
