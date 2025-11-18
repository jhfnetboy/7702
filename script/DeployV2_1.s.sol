// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/SponsoredTransferDelegationV2_1.sol";

contract DeployV2_1Script is Script {
    function run() external {
        // Read private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("VITE_RELAY_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying SponsoredTransferDelegationV2.1...");

        // Deploy V2.1 contract with default MySBT address (Sepolia)
        // Use address(0) to automatically use DEFAULT_MY_SBT = 0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C
        SponsoredTransferDelegationV2_1 v21 = new SponsoredTransferDelegationV2_1(address(0));

        console.log("SponsoredTransferDelegationV2.1 deployed at:", address(v21));
        console.log("MySBT address configured:", v21.MY_SBT());
        console.log("Version:", v21.VERSION());

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Contract: SponsoredTransferDelegationV2.1");
        console.log("Address:", address(v21));
        console.log("MySBT:", v21.MY_SBT());
        console.log("\nUpdate your .env file with:");
        console.log("VITE_SPONSORED_TRANSFER_V2_1_ADDRESS=%s", address(v21));
    }
}
