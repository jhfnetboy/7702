// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 public token;
    address public alice = address(0x1);
    address public bob = address(0x2);

    function setUp() public {
        token = new MockERC20("Test USDC", "TUSDC", 1000000);
    }

    function testInitialSupply() public {
        assertEq(token.totalSupply(), 1000000 * 10**18);
        assertEq(token.balanceOf(address(this)), 1000000 * 10**18);
    }

    function testMetadata() public {
        assertEq(token.name(), "Test USDC");
        assertEq(token.symbol(), "TUSDC");
        assertEq(token.decimals(), 18);
    }

    function testTransfer() public {
        uint256 amount = 100 * 10**18;
        assertTrue(token.transfer(alice, amount));
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(address(this)), 1000000 * 10**18 - amount);
    }

    function testTransferFrom() public {
        uint256 amount = 100 * 10**18;

        // Approve alice to spend tokens
        token.approve(alice, amount);
        assertEq(token.allowance(address(this), alice), amount);

        // Alice transfers tokens from this contract to bob
        vm.prank(alice);
        assertTrue(token.transferFrom(address(this), bob, amount));

        assertEq(token.balanceOf(bob), amount);
        assertEq(token.allowance(address(this), alice), 0);
    }

    function testMint() public {
        uint256 mintAmount = 500 * 10**18;
        uint256 balanceBefore = token.balanceOf(alice);

        token.mint(alice, mintAmount);

        assertEq(token.balanceOf(alice), balanceBefore + mintAmount);
        assertEq(token.totalSupply(), 1000000 * 10**18 + mintAmount);
    }

    function test_RevertWhen_TransferInsufficientBalance() public {
        vm.expectRevert("Insufficient balance");
        token.transfer(alice, 2000000 * 10**18); // More than total supply
    }

    function test_RevertWhen_TransferFromInsufficientAllowance() public {
        vm.expectRevert("Insufficient allowance");
        vm.prank(alice);
        token.transferFrom(address(this), bob, 100 * 10**18); // No allowance
    }
}
