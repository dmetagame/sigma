// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";

import {SoliditySigmaCore} from "../src/SoliditySigmaCore.sol";

contract DeployBenchmark is Script {
    function run() external returns (SoliditySigmaCore core) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        core = new SoliditySigmaCore();
        vm.stopBroadcast();
        console.log("SoliditySigmaCore:", address(core));
    }
}
