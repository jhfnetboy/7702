// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SponsoredTransferDelegationV2
 * @dev EIP-7702 delegation contract with ETH + ERC20 transfer support
 *
 * Features:
 * - ETH single transfer
 * - ETH batch transfer
 * - ERC20 single transfer
 * - ERC20 batch transfer
 * - ERC20 balance query
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

contract SponsoredTransferDelegationV2 {
    // ========== ETH Transfer Events ==========
    event TransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed gasPayer
    );

    event BatchTransferExecuted(
        address indexed from,
        uint256 totalAmount,
        uint256 recipientCount,
        address indexed gasPayer
    );

    // ========== ERC20 Transfer Events ==========
    event ERC20TransferExecuted(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        address gasPayer
    );

    event ERC20BatchTransferExecuted(
        address indexed from,
        address indexed token,
        uint256 totalAmount,
        uint256 recipientCount,
        address gasPayer
    );

    // ========== ETH Transfer Functions ==========

    /**
     * @dev Transfer ETH to a single recipient
     * @param to Recipient address
     * @param amount Amount to transfer in wei
     */
    function transferETH(address payable to, uint256 amount) external {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        require(to != address(0), "Invalid recipient");

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit TransferExecuted(address(this), to, amount, tx.origin);
    }

    /**
     * @dev Batch transfer ETH to multiple recipients
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransfer(
        address payable[] calldata recipients,
        uint256[] calldata amounts
    ) external {
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
            tx.origin
        );
    }

    /**
     * @dev Get ETH balance of this contract (EOA after EIP-7702)
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ========== ERC20 Transfer Functions ==========

    /**
     * @dev Transfer ERC20 tokens to a single recipient
     * @param token ERC20 token contract address
     * @param to Recipient address
     * @param amount Amount to transfer (in token's smallest unit)
     */
    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        // Call ERC20 transfer function
        bool success = IERC20(token).transfer(to, amount);
        require(success, "ERC20 transfer failed");

        emit ERC20TransferExecuted(
            address(this),
            to,
            token,
            amount,
            tx.origin
        );
    }

    /**
     * @dev Batch transfer ERC20 tokens to multiple recipients
     * @param token ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransferERC20(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(token != address(0), "Invalid token address");
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");

            // Transfer to each recipient
            bool success = IERC20(token).transfer(recipients[i], amounts[i]);
            require(success, "ERC20 transfer failed");

            totalAmount += amounts[i];
        }

        emit ERC20BatchTransferExecuted(
            address(this),
            token,
            totalAmount,
            recipients.length,
            tx.origin
        );
    }

    /**
     * @dev Get ERC20 token balance of this contract (EOA after EIP-7702)
     * @param token ERC20 token contract address
     * @return Token balance
     */
    function getERC20Balance(address token) external view returns (uint256) {
        require(token != address(0), "Invalid token address");
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Get multiple ERC20 token balances at once
     * @param tokens Array of token addresses
     * @return balances Array of token balances
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

    /**
     * @dev Get token info (symbol and decimals)
     * @param token ERC20 token contract address
     * @return symbol Token symbol
     * @return decimals Token decimals
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

    // ========== Receive ETH ==========
    receive() external payable {}
}
