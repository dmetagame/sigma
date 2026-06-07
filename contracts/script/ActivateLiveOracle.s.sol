// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";

import {IOracleAdapter} from "../src/IOracleAdapter.sol";
import {SigmaVault} from "../src/SigmaVault.sol";

contract ActivateLiveOracle is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        SigmaVault vault = SigmaVault(vm.envAddress("SIGMA_VAULT_ADDR"));
        IOracleAdapter oracle = IOracleAdapter(vm.envAddress("ORACLE_ADAPTER_ADDR"));

        // Refuse to activate an empty adapter.
        address tsla = vm.envAddress("STOCK_TSLA_ADDR");
        uint256 tslaPrice = oracle.getPrice(tsla);

        vm.startBroadcast(deployerPrivateKey);
        vault.setOracle(oracle);
        vm.stopBroadcast();

        console.log("Activated oracle:", address(oracle));
        console.log("TSLA price WAD:", tslaPrice);
    }
}
