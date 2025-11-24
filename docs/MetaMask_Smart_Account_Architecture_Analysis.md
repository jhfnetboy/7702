# MetaMask Smart Account Architecture Analysis

本文档深入分析 MetaMask Smart Accounts Kit 的能力清单，以及如何构建安全的合约来支持 Gasless 交易、批量交易、以及基于自定义 ERC-20 代币支付 Gas 费用。

## 📋 目录

- [MetaMask Smart Account 类型](#metamask-smart-account-类型)
- [能力清单与特性对比](#能力清单与特性对比)
- [Gasless 交易实现方案](#gasless-交易实现方案)
- [批量交易实现方案](#批量交易实现方案)
- [自定义 Gas 代币支付方案](#自定义-gas-代币支付方案)
- [安全最佳实践](#安全最佳实践)
- [实施建议](#实施建议)

---

## MetaMask Smart Account 类型

MetaMask Smart Accounts Kit 支持三种主要的智能账户实现：

### 1. Hybrid Smart Account (混合智能账户)

**定义**: 支持 EOA owner + 多个 Passkey (WebAuthn) 签名者的智能账户。

**特性**:
- ✅ **多签名者支持**: 可以同时使用 EOA 和 WebAuthn passkey
- ✅ **灵活部署**: 可选择 Account signer、Wallet Client signer 或 Passkey signer
- ✅ **需要部署**: 需要在链上部署智能合约（使用 `deployParams` 和 `deploySalt`）
- ✅ **持久状态**: 合约存储签名者列表和相关配置

**适用场景**:
- 需要多设备管理的钱包（手机 + 电脑）
- 需要 Passkey 无密码登录
- 企业级多签名需求

**代码示例**:
```typescript
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [
    account.address,  // EOA owner
    [],               // Passkey signers (initially empty)
    [],               // Reserved
    []                // Reserved
  ],
  deploySalt: "0x",
  signer: { account },
})
```

---

### 2. Multisig Smart Account (多签智能账户)

**定义**: 支持多个 EOA 签名者，需要达到配置的阈值才能执行操作。

**特性**:
- ✅ **阈值签名**: 例如 2-of-3 多签（3 个签名者中需要 2 个同意）
- ✅ **混合签名者**: 可以组合 Account signer 和 Wallet Client signer
- ✅ **需要部署**: 需要在链上部署智能合约
- ✅ **企业级安全**: 适合资金管理、DAO 治理等场景

**适用场景**:
- DAO 金库管理
- 企业多人审批流程
- 高价值资产托管

**代码示例**:
```typescript
const owners = [account.address, walletClient.address]
const signer = [{ account }, { walletClient }]
const threshold = 2n // 需要 2 个签名

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.MultiSig,
  deployParams: [owners, threshold],
  deploySalt: "0x",
  signer,
})
```

---

### 3. Stateless 7702 Smart Account (无状态 7702 智能账户)

**定义**: 基于 EIP-7702 升级的 EOA，不存储状态于合约中。

**特性**:
- ✅ **无需部署**: 直接基于已升级的 EOA
- ✅ **轻量级**: 不需要额外的合约部署成本
- ✅ **即时升级**: 通过 EIP-7702 自动升级 EOA
- ✅ **向后兼容**: 升级后仍可作为 EOA 使用

**适用场景**:
- **本项目的核心实现** (我们当前使用的就是这种)
- 需要快速升级现有 EOA
- 不需要复杂多签或状态管理
- 追求最小化 Gas 成本

**代码示例**:
```typescript
const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: account.address, // 已升级的 EOA 地址
  signer: { account },
})
```

> **注意**: Stateless 7702 不处理升级过程本身，需要先通过 EIP-7702 升级 EOA。

---

## 能力清单与特性对比

| 能力 | Hybrid | Multisig | Stateless 7702 | 说明 |
|------|--------|----------|----------------|------|
| **需要部署合约** | ✅ | ✅ | ❌ | 7702 无需部署，直接基于升级后的 EOA |
| **批量交易 (Batch Tx)** | ✅ | ✅ | ✅ | 所有类型都支持 EIP-5792 `sendCalls` |
| **Gasless (Paymaster)** | ✅ | ✅ | ✅ | 通过 ERC-4337 Paymaster 或 Relayer |
| **多签名者** | ✅ | ✅ | ❌ | 7702 仅支持单一 EOA 控制 |
| **Passkey 支持** | ✅ | ❌ | ❌ | 仅 Hybrid 支持 WebAuthn |
| **阈值签名** | ❌ | ✅ | ❌ | 仅 Multisig 支持 M-of-N |
| **部署成本** | 高 | 高 | **零** | 7702 最省 Gas |
| **状态存储** | 是 | 是 | 否 | 7702 无状态，控制权在 EOA |
| **自定义 Gas Token** | ✅ | ✅ | ✅ | 通过 Paymaster 实现 |

---

## Gasless 交易实现方案

Gasless 交易的核心是让第三方（Relayer 或 Paymaster）代替用户支付 Gas 费用。

### 方案 1: Relayer 模式 (我们当前实现)

**架构**:
```
User (签名) → Relayer Server (支付 Gas) → 链上执行
```

**优点**:
- ✅ 简单直接，易于理解
- ✅ 完全控制 Gas 支付逻辑
- ✅ 无需 ERC-4337 基础设施

**缺点**:
- ⚠️ 需要维护 Relayer 服务器
- ⚠️ Relayer 账户需要有足够的 ETH
- ⚠️ 存在 DoS 风险（需要限流）

**实现步骤**:
1. 用户调用 `client.signAuthorization()` 签署授权
2. 将授权发送到 Relayer Server (`POST /upgrade`)
3. Relayer 使用自己的 EOA 创建交易，包含 `authorizationList`
4. 链上验证签名并执行

**代码示例** (见 `server/server.ts`):
```typescript
// Relayer 端
const tx = await walletClient.sendTransaction({
  to: userAddress,
  authorizationList: [authorization],
  // Relayer 支付 Gas
})
```

---

### 方案 2: ERC-4337 Paymaster 模式 (推荐用于生产)

**架构**:
```
User → Bundler → Paymaster (验证 + 支付) → EntryPoint → 链上执行
```

**优点**:
- ✅ 符合 ERC-4337 标准
- ✅ 支持自定义 Gas Token（用户用 USDC 支付，Paymaster 用 ETH）
- ✅ 去中心化，可使用公共 Bundler
- ✅ 更好的安全性（EntryPoint 隔离）

**缺点**:
- ⚠️ 需要部署 Paymaster 合约
- ⚠️ 需要维护 Paymaster 的 ETH 储备
- ⚠️ 更复杂的集成

**Paymaster 合约架构**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@account-abstraction/contracts/core/BasePaymaster.sol";

contract CustomPaymaster is BasePaymaster {
    // 验证用户操作并决定是否支付 Gas
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // 1. 验证用户是否有资格（例如持有 MySBT）
        // 2. 验证用户是否支付了足够的 ERC-20 代币
        // 3. 返回验证结果
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        // 交易执行后的逻辑（例如退款）
    }
}
```

**使用方式**:
```typescript
const callId = await client.sendCalls({
  calls: [...],
  capabilities: {
    paymasterService: {
      url: "https://paymaster.example.com" // Paymaster 服务 URL
    }
  }
})
```

---

## 批量交易实现方案

批量交易通过 **EIP-5792** (`wallet_sendCalls`) 实现，MetaMask 会自动封装为 ERC-4337 UserOperation。

### 核心流程

1. **DApp 发起批量调用**:
   ```typescript
   const callId = await client.sendCalls({
     calls: [
       { to: recipient1, value: amount1 },
       { to: recipient2, value: amount2 },
       { to: tokenAddress, data: transferCalldata }
     ]
   })
   ```

2. **MetaMask 处理**:
   - 检测账户类型（Smart Account or EOA）
   - 如果是 Smart Account，封装为 `executeBatch()` 调用
   - 如果是 EOA，降级为多笔 `eth_sendTransaction`

3. **链上执行**:
   - Smart Account 的 `executeBatch()` 函数顺序执行所有 calls
   - 如果任何一笔失败，整个批次回滚（原子性）

### 批量交易合约示例

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BatchExecutor {
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    function executeBatch(Call[] calldata calls) external payable {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, ) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            require(success, "Batch call failed");
        }
    }
}
```

---

## 自定义 Gas 代币支付方案

允许用户使用 ERC-20 代币（如 USDC、USDT）支付 Gas 费用，而非 ETH。

### 架构设计

```
User (支付 USDC) → Paymaster (收取 USDC + 支付 ETH) → 链上执行
```

### Paymaster 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";

contract ERC20Paymaster is BasePaymaster {
    IERC20 public immutable gasToken; // 支持的 ERC-20 代币 (例如 USDC)
    uint256 public exchangeRate; // ETH/USDC 汇率 (例如 1 ETH = 2000 USDC)

    constructor(IEntryPoint _entryPoint, IERC20 _gasToken) BasePaymaster(_entryPoint) {
        gasToken = _gasToken;
        exchangeRate = 2000e6; // 1 ETH = 2000 USDC (6 decimals)
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // 计算所需 ERC-20 代币数量
        uint256 requiredTokens = (maxCost * exchangeRate) / 1e18;

        // 验证用户余额
        address sender = userOp.sender;
        require(gasToken.balanceOf(sender) >= requiredTokens, "Insufficient token balance");

        // 预扣 ERC-20 代币
        require(gasToken.transferFrom(sender, address(this), requiredTokens), "Token transfer failed");

        return (abi.encode(sender, requiredTokens), 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        (address sender, uint256 preCharged) = abi.decode(context, (address, uint256));

        // 计算实际花费
        uint256 actualTokenCost = (actualGasCost * exchangeRate) / 1e18;

        // 退还多余代币
        if (preCharged > actualTokenCost) {
            gasToken.transfer(sender, preCharged - actualTokenCost);
        }
    }

    // 管理员更新汇率
    function updateExchangeRate(uint256 newRate) external onlyOwner {
        exchangeRate = newRate;
    }

    // 提取收集的 ERC-20 代币
    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        gasToken.transfer(to, amount);
    }
}
```

### 使用流程

1. **部署 Paymaster**:
   ```bash
   forge create ERC20Paymaster --constructor-args <EntryPoint> <USDC_Address>
   ```

2. **为 Paymaster 充值 ETH**:
   ```typescript
   await entryPoint.depositTo(paymasterAddress, { value: parseEther("10") })
   ```

3. **用户授权 USDC**:
   ```typescript
   await usdcToken.approve(paymasterAddress, MAX_UINT256)
   ```

4. **发起交易**:
   ```typescript
   const callId = await client.sendCalls({
     calls: [...],
     capabilities: {
       paymasterService: {
         url: "https://my-paymaster.com"
       }
     }
   })
   ```

---

## 安全最佳实践

### 1. Paymaster 合约安全

- ✅ **限流 (Rate Limiting)**: 防止单个用户滥用 Gasless 服务
  ```solidity
  mapping(address => uint256) public lastUsed;
  uint256 public constant COOLDOWN = 1 hours;

  modifier rateLimit(address user) {
      require(block.timestamp - lastUsed[user] >= COOLDOWN, "Too frequent");
      lastUsed[user] = block.timestamp;
      _;
  }
  ```

- ✅ **白名单机制**: 只允许持有特定 SBT 的用户使用
  ```solidity
  IERC721 public sbtToken;

  function _validatePaymasterUserOp(...) internal override returns (...) {
      require(sbtToken.balanceOf(userOp.sender) > 0, "No SBT");
      // ...
  }
  ```

- ✅ **紧急暂停**: 允许管理员在发现异常时暂停服务
  ```solidity
  bool public paused;

  modifier whenNotPaused() {
      require(!paused, "Paused");
      _;
  }
  ```

### 2. Relayer 服务安全

- ✅ **API 限流**: 使用 Redis + express-rate-limit
- ✅ **签名验证**: 严格验证用户签名的有效性
- ✅ **Nonce 管理**: 防止重放攻击
- ✅ **监控告警**: 监控 Relayer 余额和异常请求

### 3. Gas Token 汇率安全

- ✅ **使用 Oracle**: 集成 Chainlink Price Feed 实时更新汇率
  ```solidity
  import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

  AggregatorV3Interface internal priceFeed;

  function getLatestPrice() public view returns (uint256) {
      (, int price, , , ) = priceFeed.latestRoundData();
      return uint256(price) * 1e10; // 转换为 18 decimals
  }
  ```

- ✅ **汇率保护**: 设置最大滑点保护
  ```solidity
  uint256 public maxSlippage = 500; // 5%

  function _validatePaymasterUserOp(...) internal override {
      uint256 currentRate = getLatestPrice();
      require(
          currentRate >= exchangeRate * (10000 - maxSlippage) / 10000,
          "Rate changed too much"
      );
      // ...
  }
  ```

---

## 实施建议

### Phase 1: 基础 Gasless (当前阶段)
- ✅ 使用 Relayer 模式
- ✅ 支持 EIP-7702 升级
- ✅ 手动 Gas 支付

### Phase 2: 批量交易集成 (下一步)
- 🔄 集成 EIP-5792 `sendCalls`
- 🔄 实现批量 ETH 转账
- 🔄 实现批量 ERC20 转账

### Phase 3: Paymaster 服务 (未来)
- 📋 部署 ERC-4337 Paymaster 合约
- 📋 集成 Bundler 服务 (Pimlico、StackUp)
- 📋 实现 SBT 门控

### Phase 4: 自定义 Gas Token (高级)
- 📋 部署 ERC20Paymaster
- 📋 集成 Chainlink Price Feed
- 📋 支持 USDC/USDT 支付 Gas

---

## 参考资源

- [MetaMask Smart Accounts Kit 文档](https://docs.metamask.io/smart-accounts-kit/)
- [Viem Account Abstraction](https://viem.sh/account-abstraction/accounts/smart/toMetaMaskSmartAccount)
- [EIP-7702 标准](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-5792 Wallet Call API](https://eips.ethereum.org/EIPS/eip-5792)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Delegation Framework](https://github.com/MetaMask/delegation-framework)

---

## 总结

1. **Smart Account 类型选择**:
   - 快速原型 → **Stateless 7702** (我们当前使用)
   - 需要多签 → **Multisig**
   - 需要 Passkey → **Hybrid**

2. **Gasless 实现路径**:
   - 简单场景 → **Relayer 模式**
   - 生产环境 → **ERC-4337 Paymaster**

3. **批量交易**:
   - 所有 Smart Account 类型都支持 EIP-5792

4. **自定义 Gas Token**:
   - 必须使用 **Paymaster 合约**
   - 需要 Oracle 支持汇率

5. **安全优先**:
   - 限流、白名单、紧急暂停
   - 汇率保护、监控告警
