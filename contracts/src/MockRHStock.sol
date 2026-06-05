// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockRHStock
/// @notice Stand-in for tokenized equities on Robinhood Chain testnet until real
///         stock token addresses are discovered. 18 decimals to match the OZ ERC20
///         default — value math in the vault normalizes against the oracle scale.
contract MockRHStock is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC20(name_, symbol_)
        Ownable(initialOwner)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
