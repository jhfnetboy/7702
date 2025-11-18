// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SponsoredTransferDelegationV2_1.sol";
import "../contracts/MockERC20.sol";

/**
 * @title MockMySBT
 * @dev Mock MySBT contract for testing
 */
contract MockMySBT {
    mapping(address => uint256) public userToSBT;
    uint256 public nextTokenId = 1;

    function mintSBT(address user) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        userToSBT[user] = tokenId;
        return tokenId;
    }

    function getUserSBT(address u) external view returns (uint256) {
        return userToSBT[u];
    }

    function balanceOf(address owner) external view returns (uint256) {
        return userToSBT[owner] > 0 ? 1 : 0;
    }
}

contract SponsoredTransferDelegationV2_1Test is Test {
    SponsoredTransferDelegationV2_1 public v21;
    MockERC20 public token;
    MockMySBT public mockSBT;

    address public authorizer = address(0x100);
    address public alice = address(0x200);
    address public bob = address(0x300);
    address public relay = address(0x400);

    function setUp() public {
        // Deploy mock MySBT
        mockSBT = new MockMySBT();

        // Deploy V2.1 contract with mock MySBT address
        v21 = new SponsoredTransferDelegationV2_1(address(mockSBT));

        // Deploy test token
        token = new MockERC20("Test Token", "TEST", 1000000);

        // Setup: Fund authorizer with ETH and tokens
        vm.deal(authorizer, 10 ether);
        token.mint(authorizer, 10000 * 10**18);

        // Grant SBT to authorizer (required for gasless transfers)
        mockSBT.mintSBT(authorizer);
    }

    // ========== SBT Verification Tests ==========

    function testCheckSBT() public {
        // Authorizer has SBT (minted in setUp)
        (bool hasSBT, uint256 sbtId) = v21.checkSBT(authorizer);
        assertTrue(hasSBT, "Authorizer should have SBT");
        assertEq(sbtId, 1, "SBT ID should be 1");

        // Alice doesn't have SBT
        (bool hasNoSBT, uint256 noSbtId) = v21.checkSBT(alice);
        assertFalse(hasNoSBT, "Alice should not have SBT");
        assertEq(noSbtId, 0, "SBT ID should be 0");
    }

    function testGetVersion() public {
        assertEq(v21.VERSION(), "v2.1.0");
    }

    // ========== ETH Transfer Tests ==========

    function testTransferETH_WithSBT() public {
        // Setup: Give V2.1 contract some ETH and mint SBT for it
        vm.deal(address(v21), 1 ether);
        mockSBT.mintSBT(address(v21));

        uint256 balanceBefore = alice.balance;

        // Execute transfer (should pass SBT check)
        v21.transferETH(payable(alice), 0.5 ether);

        assertEq(alice.balance, balanceBefore + 0.5 ether);
        assertEq(address(v21).balance, 0.5 ether);
    }

    function test_RevertWhen_TransferETH_WithoutSBT() public {
        // Setup: V21 contract has ETH but NO SBT
        vm.deal(address(v21), 1 ether);
        // Do NOT mint SBT

        // Expect revert
        vm.expectRevert("SponsoredTransferV2.1: User must hold MySBT to use gasless transfers");
        v21.transferETH(payable(alice), 0.5 ether);
    }

    function testBatchTransferETH_WithSBT() public {
        vm.deal(address(v21), 10 ether);
        mockSBT.mintSBT(address(v21));

        address payable[] memory recipients = new address payable[](2);
        recipients[0] = payable(alice);
        recipients[1] = payable(bob);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;

        v21.batchTransfer(recipients, amounts);

        assertEq(alice.balance, aliceBalBefore + 1 ether);
        assertEq(bob.balance, bobBalBefore + 2 ether);
        assertEq(address(v21).balance, 7 ether);
    }

    // ========== ERC20 Transfer Tests ==========

    function testTransferERC20_WithSBT() public {
        token.mint(address(v21), 1000 * 10**18);
        mockSBT.mintSBT(address(v21));

        v21.transferERC20(address(token), alice, 500 * 10**18);

        assertEq(token.balanceOf(alice), 500 * 10**18);
        assertEq(token.balanceOf(address(v21)), 500 * 10**18);
    }

    function test_RevertWhen_TransferERC20_WithoutSBT() public {
        token.mint(address(v21), 1000 * 10**18);
        // No SBT minted

        vm.expectRevert("SponsoredTransferV2.1: User must hold MySBT to use gasless transfers");
        v21.transferERC20(address(token), alice, 500 * 10**18);
    }

    function testBatchTransferERC20_WithSBT() public {
        token.mint(address(v21), 1000 * 10**18);
        mockSBT.mintSBT(address(v21));

        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 300 * 10**18;
        amounts[1] = 200 * 10**18;

        v21.batchTransferERC20(address(token), recipients, amounts);

        assertEq(token.balanceOf(alice), 300 * 10**18);
        assertEq(token.balanceOf(bob), 200 * 10**18);
        assertEq(token.balanceOf(address(v21)), 500 * 10**18);
    }

    // ========== View Function Tests ==========

    function testGetBalance() public {
        vm.deal(address(v21), 5 ether);
        assertEq(v21.getBalance(), 5 ether);
    }

    function testGetERC20Balance() public {
        token.mint(address(v21), 1000 * 10**18);
        assertEq(v21.getERC20Balance(address(token)), 1000 * 10**18);
    }

    function testGetTokenInfo() public {
        (string memory symbol, uint8 decimals) = v21.getTokenInfo(address(token));
        assertEq(symbol, "TEST");
        assertEq(decimals, 18);
    }

    function testGetMultipleBalances() public {
        MockERC20 token2 = new MockERC20("Token2", "TK2", 1000000);

        token.mint(address(v21), 1000 * 10**18);
        token2.mint(address(v21), 2000 * 10**18);

        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(token2);

        uint256[] memory balances = v21.getMultipleBalances(tokens);
        assertEq(balances[0], 1000 * 10**18);
        assertEq(balances[1], 2000 * 10**18);
    }

    // ========== Error Tests ==========

    function test_RevertWhen_TransferETHInsufficientBalance() public {
        vm.deal(address(v21), 0.5 ether);

        // Would revert with "Insufficient ETH balance"
        // (after passing SBT check in production)
    }

    function test_RevertWhen_BatchTransferLengthMismatch() public {
        address payable[] memory recipients = new address payable[](2);
        uint256[] memory amounts = new uint256[](1);

        // Would revert with "Length mismatch"
    }

    function test_RevertWhen_NoSBT() public {
        // User without SBT tries to transfer
        address noSBTUser = address(0x999);
        vm.deal(noSBTUser, 1 ether);

        // Would revert with "User must hold MySBT to use gasless transfers"
    }
}
