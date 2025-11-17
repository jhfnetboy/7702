// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Delegation
 * @dev 演示EIP-7702的简单委托合约
 */
contract Delegation {
  event Log(string message);
  event Initialized(address indexed account);
  event Pinged();

  // 存储已初始化的账户
  mapping(address => bool) public initialized;

  /**
   * @dev 初始化函数 - 用于测试EIP-7702第一次授权
   */
  function initialize() external payable {
    initialized[msg.sender] = true;
    emit Log('Hello, world!');
    emit Initialized(msg.sender);
  }

  /**
   * @dev Ping函数 - 测试后续交互
   */
  function ping() external pure {
    emit Log('Pong!');
  }

  /**
   * @dev 获取某个账户是否已初始化
   */
  function isInitialized(address account) external view returns (bool) {
    return initialized[account];
  }

  /**
   * @dev 演示支付功能
   */
  function receivePayment() external payable {
    emit Log('Payment received!');
  }
}
