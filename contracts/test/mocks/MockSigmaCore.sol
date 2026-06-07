// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ISigmaCore} from "../../src/ISigmaCore.sol";

/// @notice Mock that returns a fixed VaR so vault tests don't depend on
///         a deployed Stylus contract.
contract MockSigmaCore is ISigmaCore {
    uint256 public fixedVar;

    function setVar(uint256 v) external {
        fixedVar = v;
    }

    function computePortfolioVar(uint256[] calldata, uint256[] calldata, int256[] calldata, uint256, uint256, uint256)
        external
        view
        returns (uint256)
    {
        return fixedVar;
    }
}
