// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SponsoredTransferDelegation
 * @dev EIP-7702 赞助转账合约
 *
 * 核心概念:
 * - address(this) = 被授权的 EOA 地址 (Authorizer)
 * - msg.sender = 交易发起者 (可以是 Authorizer 自己，也可以是 Relay)
 * - Gas 支付: 由 msg.sender 支付
 * - 转账金额: 从 address(this) 的余额扣除
 */
contract SponsoredTransferDelegation {
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

    /**
     * @dev 从授权的 EOA 转账到目标地址
     * @param to 接收方地址
     * @param amount 转账金额 (wei)
     *
     * 执行逻辑:
     * - address(this): 被授权的 EOA (余额来源)
     * - msg.sender: 交易发起者 (gas 支付方)
     * - 从 address(this) 转出 amount
     * - gas 由 msg.sender 支付
     */
    function transferETH(address payable to, uint256 amount) external {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient balance in EOA");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit TransferExecuted(address(this), to, amount, msg.sender);
    }

    /**
     * @dev 批量转账
     * @param recipients 接收方地址数组
     * @param amounts 对应的金额数组
     */
    function batchTransfer(
        address payable[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(address(this).balance >= totalAmount, "Insufficient balance");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");

            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            require(success, "Transfer failed");

            emit TransferExecuted(address(this), recipients[i], amounts[i], msg.sender);
        }

        emit BatchTransferExecuted(address(this), totalAmount, recipients.length, msg.sender);
    }

    /**
     * @dev 查询授权 EOA 的余额
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev 允许接收 ETH (如果需要向 EOA 充值)
     */
    receive() external payable {}
}
