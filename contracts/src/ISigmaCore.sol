// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Solidity interface to the Sigma Core Stylus contract.
///         All scalar inputs are WAD (1e18); portfolio_value and the returned
///         VaR are in USDC 6-decimal units. `corrPacked` is the upper-triangular
///         correlation matrix including the diagonal, indexed by
///         idx(i,j) = i·(2n-i+1)/2 + (j-i) for i ≤ j.
interface ISigmaCore {
    function computePortfolioVar(
        uint256[] calldata weights,
        uint256[] calldata vols,
        int256[] calldata corrPacked,
        uint256 portfolioValue,
        uint256 zScore,
        uint256 horizonSqrt
    ) external view returns (uint256);
}
