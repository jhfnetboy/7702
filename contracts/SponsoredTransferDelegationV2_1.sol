// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SponsoredTransferDelegationV2.1
 * @dev EIP-7702 delegation contract with SBT verification for gasless transfers
 *
 * Core Features:
 * - ✅ MySBT verification: Only SBT holders can use gasless transfers
 * - ✅ ETH & ERC20 transfers (single + batch)
 * - ✅ Relay-sponsored gas (users don't need ETH for gas)
 * - ✅ Anti-abuse mechanism through SBT gating
 *
 * Use Case:
 * Provide gasless transfer service to MySBT holders, even if their EOA has 0 ETH
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

interface IMySBT {
    /// @notice Get user's SBT token ID (returns 0 if user has no SBT)
    function getUserSBT(address u) external view returns (uint256);

    /// @notice Get SBT balance of user (should be 0 or 1 for SBT)
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Verify if user is member of a specific community
    function verifyCommunityMembership(address u, address comm) external view returns (bool);
}

contract SponsoredTransferDelegationV2_1 {
    // ========== State Variables ==========

    /// @notice MySBT contract address (configurable for testing)
    address public immutable MY_SBT;

    /// @notice Default MySBT address on Sepolia (from @aastar/shared-config)
    address public constant DEFAULT_MY_SBT = 0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C;

    /// @notice Contract version
    string public constant VERSION = "v2.1.0";

    // ========== Constructor ==========

    /**
     * @dev Constructor
     * @param _mySBT MySBT contract address (use address(0) for default Sepolia address)
     */
    constructor(address _mySBT) {
        MY_SBT = _mySBT == address(0) ? DEFAULT_MY_SBT : _mySBT;
    }

    // ========== Events ==========

    event TransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed gasPayer,
        bool hasSBT
    );

    event BatchTransferExecuted(
        address indexed from,
        uint256 totalAmount,
        uint256 recipientCount,
        address indexed gasPayer,
        bool hasSBT
    );

    event ERC20TransferExecuted(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        address gasPayer,
        bool hasSBT
    );

    event ERC20BatchTransferExecuted(
        address indexed from,
        address indexed token,
        uint256 totalAmount,
        uint256 recipientCount,
        address gasPayer,
        bool hasSBT
    );

    event SBTVerificationFailed(
        address indexed user,
        string reason
    );

    // ========== Modifiers ==========

    /**
     * @dev Verify that the user (address(this) in EIP-7702 context) holds a MySBT
     * This ensures only SBT holders can use the gasless transfer service
     */
    modifier requireSBT() {
        IMySBT sbtContract = IMySBT(MY_SBT);
        uint256 sbtId = sbtContract.getUserSBT(address(this));

        if (sbtId == 0) {
            emit SBTVerificationFailed(address(this), "No MySBT found");
            revert("SponsoredTransferV2.1: User must hold MySBT to use gasless transfers");
        }

        _;
    }

    // ========== View Functions ==========

    /**
     * @dev Check if an address holds MySBT
     * @param user Address to check
     * @return hasSBT Whether the user holds MySBT
     * @return sbtId The SBT token ID (0 if none)
     */
    function checkSBT(address user) external view returns (bool hasSBT, uint256 sbtId) {
        IMySBT sbtContract = IMySBT(MY_SBT);
        sbtId = sbtContract.getUserSBT(user);
        hasSBT = (sbtId > 0);
    }

    /**
     * @dev Get ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get ERC20 token balance
     */
    function getERC20Balance(address token) external view returns (uint256) {
        require(token != address(0), "Invalid token address");
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Get token info (symbol and decimals)
     */
    function getTokenInfo(address token)
        external
        view
        returns (string memory symbol, uint8 decimals)
    {
        require(token != address(0), "Invalid token address");
        symbol = IERC20(token).symbol();
        decimals = IERC20(token).decimals();
    }

    // ========== ETH Transfer Functions ==========

    /**
     * @dev Transfer ETH to a single recipient (SBT required)
     * @param to Recipient address
     * @param amount Amount to transfer in wei
     *
     * Gas paid by: Relay (tx.origin)
     * ETH deducted from: EOA (address(this))
     * Access: Only MySBT holders
     */
    function transferETH(address payable to, uint256 amount)
        external
        requireSBT
    {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        require(to != address(0), "Invalid recipient");

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit TransferExecuted(address(this), to, amount, tx.origin, true);
    }

    /**
     * @dev Batch transfer ETH to multiple recipients (SBT required)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransfer(
        address payable[] calldata recipients,
        uint256[] calldata amounts
    )
        external
        requireSBT
    {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            totalAmount += amounts[i];
        }

        require(address(this).balance >= totalAmount, "Insufficient ETH balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            require(success, "ETH transfer failed");
        }

        emit BatchTransferExecuted(
            address(this),
            totalAmount,
            recipients.length,
            tx.origin,
            true
        );
    }

    // ========== ERC20 Transfer Functions ==========

    /**
     * @dev Transfer ERC20 tokens to a single recipient (SBT required)
     * @param token ERC20 token contract address
     * @param to Recipient address
     * @param amount Amount to transfer (in token's smallest unit)
     */
    function transferERC20(
        address token,
        address to,
        uint256 amount
    )
        external
        requireSBT
    {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        bool success = IERC20(token).transfer(to, amount);
        require(success, "ERC20 transfer failed");

        emit ERC20TransferExecuted(
            address(this),
            to,
            token,
            amount,
            tx.origin,
            true
        );
    }

    /**
     * @dev Batch transfer ERC20 tokens to multiple recipients (SBT required)
     * @param token ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransferERC20(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    )
        external
        requireSBT
    {
        require(token != address(0), "Invalid token address");
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");

            bool success = IERC20(token).transfer(recipients[i], amounts[i]);
            require(success, "ERC20 transfer failed");

            totalAmount += amounts[i];
        }

        emit ERC20BatchTransferExecuted(
            address(this),
            token,
            totalAmount,
            recipients.length,
            tx.origin,
            true
        );
    }

    /**
     * @dev Get multiple ERC20 token balances at once
     */
    function getMultipleBalances(address[] calldata tokens)
        external
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                balances[i] = IERC20(tokens[i]).balanceOf(address(this));
            }
        }
        return balances;
    }

    // ========== Receive ETH ==========
    receive() external payable {}
}
