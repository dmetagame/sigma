// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ISigmaCore} from "./ISigmaCore.sol";

/// @title SoliditySigmaCore
/// @notice Solidity reference implementation of Sigma Core used only for
///         correctness and gas comparisons with the deployed Stylus engine.
contract SoliditySigmaCore is ISigmaCore {
    uint256 public constant WAD = 1e18;
    uint256 public lastVar;

    error SignedOverflow();
    error SqrtOverflow();

    function computePortfolioVar(
        uint256[] calldata weights,
        uint256[] calldata vols,
        int256[] calldata corrPacked,
        uint256 portfolioValue,
        uint256 zScore,
        uint256 horizonSqrt
    ) public pure returns (uint256) {
        uint256 n = weights.length;
        if (n == 0 || vols.length != n || corrPacked.length != (n * (n + 1)) / 2) return 0;

        int256 variance = 0;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n; j++) {
                uint256 term = _mulWad(weights[i], weights[j]);
                term = _mulWad(term, vols[i]);
                term = _mulWad(term, vols[j]);
                int256 signedTerm = _toInt(term);
                variance += _mulWadSigned(signedTerm, _readCorrelation(corrPacked, n, i, j));
            }
        }

        if (variance <= 0) return 0;
        uint256 varianceUnsigned = uint256(variance);
        if (varianceUnsigned > type(uint256).max / WAD) revert SqrtOverflow();
        uint256 portfolioVol = Math.sqrt(varianceUnsigned * WAD);
        uint256 varPct = _mulWad(_mulWad(zScore, portfolioVol), horizonSqrt);
        return Math.mulDiv(portfolioValue, varPct, WAD);
    }

    function recordVar(
        uint256[] calldata weights,
        uint256[] calldata vols,
        int256[] calldata corrPacked,
        uint256 portfolioValue,
        uint256 zScore,
        uint256 horizonSqrt
    ) external returns (uint256 value) {
        value = computePortfolioVar(weights, vols, corrPacked, portfolioValue, zScore, horizonSqrt);
        lastVar = value;
    }

    function _readCorrelation(int256[] calldata packed, uint256 n, uint256 i, uint256 j)
        internal
        pure
        returns (int256)
    {
        (uint256 a, uint256 b) = i <= j ? (i, j) : (j, i);
        uint256 index = (a * (2 * n - a + 1)) / 2 + (b - a);
        return packed[index];
    }

    function _mulWad(uint256 a, uint256 b) internal pure returns (uint256) {
        return Math.mulDiv(a, b, WAD);
    }

    function _mulWadSigned(int256 a, int256 b) internal pure returns (int256) {
        if (a == 0 || b == 0) return 0;
        bool negative = (a < 0) != (b < 0);
        uint256 absoluteA = _absolute(a);
        uint256 absoluteB = _absolute(b);
        uint256 product = Math.mulDiv(absoluteA, absoluteB, WAD);
        if (product > uint256(type(int256).max)) revert SignedOverflow();
        int256 signedProduct = int256(product);
        return negative ? -signedProduct : signedProduct;
    }

    function _absolute(int256 value) internal pure returns (uint256) {
        if (value == type(int256).min) revert SignedOverflow();
        return uint256(value < 0 ? -value : value);
    }

    function _toInt(uint256 value) internal pure returns (int256) {
        if (value > uint256(type(int256).max)) revert SignedOverflow();
        return int256(value);
    }
}
