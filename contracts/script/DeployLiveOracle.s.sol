// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";

import {CrossCheckedOracleAdapter} from "../src/CrossCheckedOracleAdapter.sol";

contract DeployLiveOracle is Script {
    function run() external returns (CrossCheckedOracleAdapter adapter) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);
        address reporter = vm.envAddress("ORACLE_REPORTER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        adapter = new CrossCheckedOracleAdapter(owner, reporter);
        vm.stopBroadcast();

        console.log("CrossCheckedOracleAdapter:", address(adapter));
        console.log("Reporter:", reporter);
    }
}
