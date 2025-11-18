// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MockERC20.sol";
import "../contracts/SponsoredTransferDelegationV2.sol";

contract DeployScript is Script {
    function run() external {
        // Read private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("VITE_RELAY_PRIVATE_KEY");

        // Get authorizer address from env (for minting tokens)
        address authorizer = vm.envAddress("VITE_AUTHORIZER");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockERC20
        console.log("Deploying MockERC20...");
        MockERC20 token = new MockERC20("Test USDC", "TUSDC", 1000000);
        console.log("MockERC20 deployed at:", address(token));

        // 2. Mint tokens to authorizer
        console.log("Minting 10000 TUSDC to authorizer:", authorizer);
        token.mint(authorizer, 10000 * 10**18);

        // 3. Deploy SponsoredTransferDelegationV2
        console.log("Deploying SponsoredTransferDelegationV2...");
        SponsoredTransferDelegationV2 v2 = new SponsoredTransferDelegationV2();
        console.log("SponsoredTransferDelegationV2 deployed at:", address(v2));

        vm.stopBroadcast();

        // Output deployment addresses
        console.log("\n=== Deployment Summary ===");
        console.log("MockERC20 (TUSDC):", address(token));
        console.log("SponsoredTransferDelegationV2:", address(v2));
        console.log("\nUpdate your .env file with these addresses:");
        console.log("VITE_MOCK_ERC20_ADDRESS=%s", address(token));
        console.log("VITE_SPONSORED_TRANSFER_V2_ADDRESS=%s", address(v2));
    }
}
