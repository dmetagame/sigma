// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {SigmaVault} from "../src/SigmaVault.sol";
import {SigmaStrategist} from "../src/SigmaStrategist.sol";

/// @notice Seeds a fresh Sigma deployment with one reproducible demo position.
/// @dev Intended for testnet only. Reverts if the deployer already has a position.
contract SeedDemo is Script {
    using SafeERC20 for IERC20;

    uint256 constant VAULT_LIQUIDITY = 200e6;
    uint256 constant TSLA_COLLATERAL = 1e18;

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 pilotPk = vm.envUint("PILOT_PRIVATE_KEY");
        address user = vm.addr(deployerPk);
        address pilot = vm.addr(pilotPk);

        SigmaVault vault = SigmaVault(vm.envAddress("SIGMA_VAULT_ADDR"));
        SigmaStrategist strategist = SigmaStrategist(vm.envAddress("SIGMA_STRATEGIST_ADDR"));
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDR"));
        IERC20 tsla = IERC20(vm.envAddress("STOCK_TSLA_ADDR"));

        require(address(strategist.vault()) == address(vault), "strategist/vault mismatch");
        require(vault.collateral(user, address(tsla)) == 0 && vault.debt(user) == 0, "demo already seeded");
        require(usdc.balanceOf(user) >= VAULT_LIQUIDITY, "insufficient demo USDC");
        require(tsla.balanceOf(user) >= TSLA_COLLATERAL, "insufficient demo TSLA");

        vm.startBroadcast(deployerPk);
        usdc.safeTransfer(address(vault), VAULT_LIQUIDITY);
        tsla.forceApprove(address(vault), TSLA_COLLATERAL);
        vault.deposit(address(tsla), TSLA_COLLATERAL);
        vault.setExecutor(address(strategist));
        usdc.forceApprove(address(strategist), type(uint256).max);
        strategist.register(
            SigmaStrategist.Policy({
                agent: pilot,
                maxBorrow6: 150e6,
                maxStockShare: 1e18,
                minHealthFactor: 1.2e18,
                cooldownSec: 5,
                active: true
            })
        );
        vm.stopBroadcast();

        console.log("Demo user:", user);
        console.log("Pilot:", pilot);
        console.log("Vault liquidity before demo borrow:", usdc.balanceOf(address(vault)));
    }
}
