// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {SoliditySigmaCore} from "../src/SoliditySigmaCore.sol";

contract SoliditySigmaCoreTest is Test {
    SoliditySigmaCore core;

    function setUp() public {
        core = new SoliditySigmaCore();
    }

    function test_matches_stylus_reference_vector() public view {
        uint256[] memory weights = new uint256[](2);
        weights[0] = 0.5e18;
        weights[1] = 0.5e18;

        uint256[] memory vols = new uint256[](2);
        vols[0] = 0.2e18;
        vols[1] = 0.3e18;

        int256[] memory corr = new int256[](3);
        corr[0] = 1e18;
        corr[1] = 0.5e18;
        corr[2] = 1e18;

        uint256 value = core.computePortfolioVar(
            weights, vols, corr, 1_000_000e6, 1_645_000_000_000_000_000, 62_994_079_237_678_000
        );
        assertEq(value, 22_584_601_892);
    }

    function test_record_var_persists_same_result() public {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        uint256[] memory vols = new uint256[](1);
        vols[0] = 0.45e18;
        int256[] memory corr = new int256[](1);
        corr[0] = 1e18;

        uint256 value = core.recordVar(weights, vols, corr, 280e6, 1_645_000_000_000_000_000, 62_994_079_237_678_000);
        assertEq(core.lastVar(), value);
        assertGt(value, 0);
    }

    function test_invalid_lengths_return_zero() public view {
        uint256[] memory weights = new uint256[](2);
        uint256[] memory vols = new uint256[](1);
        int256[] memory corr = new int256[](1);
        assertEq(core.computePortfolioVar(weights, vols, corr, 1e6, 1e18, 1e18), 0);
    }

    function test_negative_variance_is_clamped() public view {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        uint256[] memory vols = new uint256[](1);
        vols[0] = 1e18;
        int256[] memory corr = new int256[](1);
        corr[0] = -1e18;
        assertEq(core.computePortfolioVar(weights, vols, corr, 1e6, 1e18, 1e18), 0);
    }
}
