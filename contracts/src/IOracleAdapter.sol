// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Pluggable price feed. Sigma reads USDC-denominated prices from this.
///         Implementations: MockOracle (demo), ChainlinkAdapter (testnet feeds).
/// @dev All prices are returned scaled to 1e18 (WAD), USDC per 1 token unit.
interface IOracleAdapter {
    /// @notice Latest price for `stock`, scaled to 1e18 (USDC per token).
    function getPrice(address stock) external view returns (uint256);
}
