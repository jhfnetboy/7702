// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {MySBTGatedEnforcer} from "../contracts/enforcers/MySBTGatedEnforcer.sol";
import {BatchTransferEnforcer} from "../contracts/enforcers/BatchTransferEnforcer.sol";

/**
 * @title Deploy Enforcers Script
 * @notice Deploy custom caveat enforcers for MetaMask Delegation Framework
 * @dev Run with: forge script script/DeployEnforcers.s.sol --rpc-url $RPC_URL --broadcast
 */
contract DeployEnforcersScript is Script {
    // MySBT contract address on Sepolia (from shared-config)
    address constant MY_SBT = 0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MySBTGatedEnforcer
        console.log("Deploying MySBTGatedEnforcer...");
        MySBTGatedEnforcer mySBTEnforcer = new MySBTGatedEnforcer(MY_SBT);
        console.log("MySBTGatedEnforcer deployed at:", address(mySBTEnforcer));

        // Deploy BatchTransferEnforcer
        console.log("Deploying BatchTransferEnforcer...");
        BatchTransferEnforcer batchEnforcer = new BatchTransferEnforcer();
        console.log("BatchTransferEnforcer deployed at:", address(batchEnforcer));

        // Stop broadcasting
        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("MySBT Address:", MY_SBT);
        console.log("MySBTGatedEnforcer:", address(mySBTEnforcer));
        console.log("BatchTransferEnforcer:", address(batchEnforcer));
        console.log("\n✅ Deployment complete!");
        console.log("\n⚠️  Remember to update these addresses in shared-config!");
    }
}