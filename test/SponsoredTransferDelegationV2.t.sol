// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SponsoredTransferDelegationV2.sol";
import "../contracts/MockERC20.sol";

contract SponsoredTransferDelegationV2Test is Test {
    SponsoredTransferDelegationV2 public delegation;
    MockERC20 public token;

    address public authorizer = address(0x100);
    address public relay = address(0x200);
    address public recipient1 = address(0x300);
    address public recipient2 = address(0x400);
    address public recipient3 = address(0x500);

    function setUp() public {
        // Deploy contracts
        delegation = new SponsoredTransferDelegationV2();
        token = new MockERC20("Test USDC", "TUSDC", 1000000);

        // Fund authorizer with ETH and tokens
        vm.deal(authorizer, 10 ether);
        token.transfer(authorizer, 10000 * 10**18);

        // Simulate delegation contract at authorizer address
        // In EIP-7702, the delegation contract code is at the EOA address
        vm.etch(authorizer, address(delegation).code);

        // Set storage for balances
        vm.store(
            authorizer,
            keccak256(abi.encode(authorizer, uint256(0))), // Assuming slot 0 is ETH balance
            bytes32(uint256(10 ether))
        );
    }

    // ========== ETH Transfer Tests ==========

    function testTransferETH() public {
        uint256 amount = 1 ether;
        uint256 balanceBefore = recipient1.balance;

        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).transferETH(
            payable(recipient1),
            amount
        );

        assertEq(recipient1.balance, balanceBefore + amount);
    }

    function testBatchTransferETH() public {
        address payable[] memory recipients = new address payable[](3);
        recipients[0] = payable(recipient1);
        recipients[1] = payable(recipient2);
        recipients[2] = payable(recipient3);

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;
        amounts[2] = 3 ether;

        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).batchTransfer(
            recipients,
            amounts
        );

        assertEq(recipient1.balance, 1 ether);
        assertEq(recipient2.balance, 2 ether);
        assertEq(recipient3.balance, 3 ether);
    }

    function testGetBalance() public {
        uint256 balance = SponsoredTransferDelegationV2(payable(authorizer)).getBalance();
        assertGt(balance, 0);
    }

    // ========== ERC20 Transfer Tests ==========

    function testTransferERC20() public {
        uint256 amount = 100 * 10**18;

        // Transfer tokens to delegation contract (authorizer address after EIP-7702)
        vm.prank(address(this));
        token.transfer(authorizer, amount);

        uint256 balanceBefore = token.balanceOf(recipient1);

        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).transferERC20(
            address(token),
            recipient1,
            amount
        );

        assertEq(token.balanceOf(recipient1), balanceBefore + amount);
    }

    function testBatchTransferERC20() public {
        uint256 totalAmount = 600 * 10**18;

        // Transfer tokens to delegation contract
        vm.prank(address(this));
        token.transfer(authorizer, totalAmount);

        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 10**18;
        amounts[1] = 200 * 10**18;
        amounts[2] = 300 * 10**18;

        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).batchTransferERC20(
            address(token),
            recipients,
            amounts
        );

        assertEq(token.balanceOf(recipient1), 100 * 10**18);
        assertEq(token.balanceOf(recipient2), 200 * 10**18);
        assertEq(token.balanceOf(recipient3), 300 * 10**18);
    }

    function testGetERC20Balance() public {
        // Authorizer already has 10000 tokens from setUp
        uint256 balance = SponsoredTransferDelegationV2(payable(authorizer)).getERC20Balance(
            address(token)
        );

        assertEq(balance, 10000 * 10**18);
    }

    function testGetMultipleBalances() public {
        // Create another token
        MockERC20 token2 = new MockERC20("Test DAI", "TDAI", 500000);

        // Authorizer already has 10000 TUSDC from setUp
        // Transfer token2 to authorizer
        token2.transfer(authorizer, 2000 * 10**18);

        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(token2);

        uint256[] memory balances = SponsoredTransferDelegationV2(payable(authorizer))
            .getMultipleBalances(tokens);

        assertEq(balances[0], 10000 * 10**18); // TUSDC from setUp
        assertEq(balances[1], 2000 * 10**18);  // TDAI just transferred
    }

    function testGetTokenInfo() public {
        (string memory symbol, uint8 decimals) = SponsoredTransferDelegationV2(
            payable(authorizer)
        ).getTokenInfo(address(token));

        assertEq(symbol, "TUSDC");
        assertEq(decimals, 18);
    }

    // ========== Failure Tests ==========

    function test_RevertWhen_TransferETHInsufficientBalance() public {
        vm.expectRevert("Insufficient ETH balance");
        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).transferETH(
            payable(recipient1),
            100 ether // More than balance
        );
    }

    function test_RevertWhen_BatchTransferLengthMismatch() public {
        address payable[] memory recipients = new address payable[](2);
        recipients[0] = payable(recipient1);
        recipients[1] = payable(recipient2);

        uint256[] memory amounts = new uint256[](3); // Mismatch
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;
        amounts[2] = 3 ether;

        vm.expectRevert("Length mismatch");
        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).batchTransfer(
            recipients,
            amounts
        );
    }

    function test_RevertWhen_TransferERC20ZeroAddress() public {
        vm.expectRevert("Invalid token address");
        vm.prank(relay);
        SponsoredTransferDelegationV2(payable(authorizer)).transferERC20(
            address(0),
            recipient1,
            100 * 10**18
        );
    }
}
