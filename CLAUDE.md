# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EIP-7702 演示应用 - 完整的 EOA 账户授权和智能合约委托实现，展示 EIP-7702 标准在无 Gas 转账场景中的应用。

## 核心架构

### 三层合约设计

1. **Basic Delegation** (`0x9381bbF662e415737FC33fecC71A660A6f642928`)
   - 基础 EIP-7702 演示
   - 函数: `initialize()`, `ping()`

2. **SponsoredTransferV2** (`0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05`)
   - ETH + ERC20 双资产支持
   - 单笔/批量转账
   - 无需 `initialize()`，仅授权即可使用

3. **SponsoredTransferV2.1** (待部署)
   - MySBT 身份验证 (`0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C`)
   - 完全无 Gas 服务（Relay 代付）
   - 防滥用机制

### EIP-7702 工作流程

**关键**: 不同合约的授权流程不同！

#### Basic Delegation 流程
1. 签署授权 (`signAuthorization`)
2. **发送带 `initialize()` 的交易** (重要)
3. 后续调用 `ping()`

#### SponsoredTransferV2/V2.1 流程
1. 签署授权 (`signAuthorization`)
2. **只发送授权，不调用任何函数** (V2 无 `initialize()`)
3. 直接调用转账函数

**常见错误**: V2 合约调用 `initialize()` 会导致 revert！

### 代码组织

```
src/
├── hooks/
│   ├── useEIP7702.ts      # EIP-7702 核心逻辑 (Viem 2.39)
│   └── useMetaMask.ts     # MetaMask 连接
├── config/
│   ├── viem.ts            # Relay 账户配置 (中继支付 Gas)
│   └── contract.ts        # 合约 ABI + 地址配置
└── components/
    └── EIP7702Demo.tsx    # UI 交互

contracts/
├── Delegation.sol                      # Basic
├── SponsoredTransferDelegationV2.sol   # V2
└── SponsoredTransferDelegationV2_1.sol # V2.1 (MySBT)
```

### Viem 2.39 标准实现

项目严格遵循 Viem 官方 EIP-7702 API:

```typescript
// 1. 签署授权
const authorization = await walletClient.signAuthorization({
  account: eoa,
  contractAddress: delegationAddress
})

// 2. 广播授权 (根据合约类型决定是否调用 initialize)
await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: contractType === 'delegation'
    ? encodeFunctionData({ abi, functionName: 'initialize' })
    : undefined,  // V2/V2.1 不调用任何函数
  to: eoa.address
})

// 3. 后续交互
await walletClient.sendTransaction({
  data: encodeFunctionData({ abi, functionName: 'transferETH', args }),
  to: eoa.address
})
```

**参考**: `src/hooks/useEIP7702.ts:75-133`

## 开发命令

### 前端开发
```bash
pnpm install              # 安装依赖
pnpm run dev              # 启动开发服务器 (http://localhost:5173)
pnpm run build            # 生产构建
pnpm run type-check       # TypeScript 类型检查
```

### 测试
```bash
# Playwright E2E 测试 (72 个测试用例)
pnpm test                 # Headless 模式
pnpm test:headed          # 显示浏览器
pnpm exec playwright show-report

# Foundry 合约测试
forge test                # 运行所有测试
forge test -vvv           # 详细输出
forge test --match-test testTransferETH  # 运行单个测试
```

### 合约开发
```bash
# 编译
forge build

# 部署 (需要配置 .env)
forge script script/DeployV2_1.s.sol:DeployV2_1Script \
  --rpc-url $VITE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# 验证合约
forge verify-contract <address> SponsoredTransferDelegationV2_1 \
  --chain sepolia \
  --watch
```

### 调试工具
```bash
# 分析交易失败原因 (RPC 级别诊断)
pnpm tsx scripts/analyze-tx.ts <tx-hash>
```

## 环境配置

必需的环境变量 (`.env`):

```bash
# RPC 配置 (Alchemy/Infura)
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Relay 账户 (支付所有 Gas，需要 Sepolia ETH)
VITE_RELAY_PRIVATE_KEY=0x...

# 合约地址 (已部署)
VITE_DELEGATION_CONTRACT_ADDRESS=0x9381bbF662e415737FC33fecC71A660A6f642928
VITE_SPONSORED_TRANSFER_V2_ADDRESS=0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05
VITE_MOCK_ERC20_ADDRESS=0x202DAd7EbAC4282263174544605304500bFcbaF7
```

**重要**: Relay 账户必须有 Sepolia ETH，从 [Alchemy Faucet](https://sepoliafaucet.com/) 获取测试币。

## 关键设计决策

### 1. 为何 V2 合约不调用 `initialize()`？
- V2/V2.1 合约没有 `initialize()` 函数
- 授权后直接可用，无需初始化
- 与 Basic Delegation 的关键区别

### 2. Relay vs Authorizer 角色
- **Relay**: 中继账户，使用私钥签署交易，支付所有 Gas
- **Authorizer**: 授权者 EOA，签署 EIP-7702 授权，但不支付 Gas
- Relay 在 `src/config/viem.ts` 中配置

### 3. MySBT 身份验证 (V2.1)
- SBT 合约地址: `0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C`
- 所有转账函数都带 `requireSBT()` modifier
- 防止无身份用户滥用无 Gas 服务

### 4. 自动合约检测
应用能自动识别 EOA 已授权给哪个合约:
- 读取 EOA 的 code
- 与已知合约地址匹配
- 智能切换 UI 状态

**参考**: `src/hooks/useEIP7702.ts` 中的状态检测逻辑

## 测试覆盖

### Foundry 测试 (Solidity)
- `test/SponsoredTransferDelegationV2.t.sol` - 18 个测试用例
- `test/SponsoredTransferDelegationV2_1.t.sol` - 15 个测试用例
- 覆盖: ETH/ERC20 单笔/批量转账、SBT 验证、边界情况

### Playwright 测试 (E2E)
- `tests/app.spec.ts` - 72 个测试用例
- 覆盖: 页面加载、导航、表单、响应式设计

## 常见问题

### 授权失败: "execution reverted"
检查合约类型:
- Basic Delegation → 需要调用 `initialize()`
- V2/V2.1 → 不能调用 `initialize()`

### 交易失败: "insufficient funds"
确保 Relay 账户有 Sepolia ETH:
```bash
# 检查余额
cast balance $VITE_RELAY --rpc-url $VITE_SEPOLIA_RPC_URL
```

### MySBT 验证失败
检查用户是否持有 SBT:
```bash
cast call 0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C \
  "getUserSBT(address)(uint256)" <user-address> \
  --rpc-url $VITE_SEPOLIA_RPC_URL
```

## 技术栈版本

- **Solidity**: 0.8.20
- **Foundry**: 1.4.4+
- **Viem**: 2.39.0 (EIP-7702 支持)
- **React**: 18.2
- **Vite**: 5.0
- **TypeScript**: 5.3
- **Playwright**: 1.56

## 重要文档

- [EIP-7702 原理详解](./docs/EIP-7702-EXPLANATION.md)
- [Gas 成本分析](./docs/GAS-ANALYSIS.md)
- [V2.1 MySBT 服务文档](./docs/V2.1-SBT-GASLESS-SERVICE.md)
- [部署指南](./docs/DEPLOYMENT.md)
- [快速开始](./docs/QUICKSTART.md)
