# EIP-7702 Demo Application

完整的 EIP-7702 演示应用，展示 EOA 账户授权和智能合约委托的完整流程。

## 🎉 v2.1.0 新功能 - MySBT 无 Gas 转账服务

- 🔐 **MySBT 身份验证**: 只有 MySBT 持有者可以使用无 Gas 转账
- ⚡ **完全无 Gas**: 即使 EOA 没有 ETH 也能转账（Relay 代付 Gas）
- 💎 **ETH + ERC20**: 支持原生代币和 ERC20 代币转账
- 📦 **批量转账**: 单笔交易完成多个转账
- 🛡️ **防滥用机制**: SBT 门槛 + 事件日志
- ✅ **15/15 测试通过**: 全面的 Foundry 测试覆盖

详见: [V2.1 完整文档](./docs/V2.1-SBT-GASLESS-SERVICE.md)

## 🎉 v1.2.1 修复

- 🐛 **重要修复**: 修复 SponsoredTransferV2 授权失败问题
  - 问题: 步骤2 错误调用不存在的 `initialize()` 函数导致交易 revert
  - 解决: 只有 Basic Delegation 调用 `initialize()`，V2 合约仅做授权
- 🔍 **新增工具**: RPC 交易分析脚本 (`scripts/analyze-tx.ts`)

## 🎉 v1.2.0 新功能

- ⭐ **ERC20 代币支持**: 单笔和批量 ERC20 代币转账
- ⭐ **三个合约选项**: Basic Delegation / Sponsored Transfer / **Sponsored Transfer V2 (ETH + ERC20)**
- ⭐ **资产类型选择**: 在 V2 合约中切换 ETH 或 ERC20 转账
- ⭐ **代币余额查询**: 实时显示 ERC20 代币余额
- ⭐ **自动合约检测**: 自动识别 EOA 授权给了哪个合约
- ⭐ **Foundry 测试**: 18/18 测试用例通过
- ⭐ **已部署到 Sepolia**: MockERC20 (TUSDC) + SponsoredTransferV2

## 核心功能

- ✅ **完整的 EIP-7702 工作流**: 签署授权 → 广播交易 → 验证执行
- ✅ **ETH 转账**: 单笔和批量 ETH 转账 (Gas 由 Relay 或 Authorizer 支付)
- ✅ **ERC20 转账**: 单笔和批量 ERC20 代币转账 (仅 V2 合约)
- ✅ **EOA 状态检测**: 自动检测 EOA 是否已授权，智能按钮状态管理
- ✅ **撤回授权**: 支持撤回 EIP-7702 授权，恢复 EOA 原始状态
- ✅ **详细的控制台日志**: 每个步骤都有完整的前后数据结构输出
- ✅ **Playwright E2E 测试**: 72个测试用例覆盖所有UI功能
- ✅ **Viem 2.39 标准 API**: 完全遵循官方 Viem EIP-7702 文档
- ✅ **Sepolia 测试网集成**: 真实链上交互和验证

## 项目结构

```
src/
├── components/
│   ├── MetaMaskConnect.tsx / .css
│   └── EIP7702Demo.tsx / .css
├── config/
│   ├── viem.ts              # Viem客户端配置
│   └── contract.ts          # 合约ABI
├── hooks/
│   ├── useMetaMask.ts
│   └── useEIP7702.ts
└── App.tsx / App.css
```

## 快速开始

```bash
# 安装
pnpm install

# 配置环境
cp .env.example .env

# 启动
pnpm run dev
```

## 使用

1. **Dashboard**: 连接MetaMask，配置授权地址
2. **Demo**: 输入私钥 → 初始化 → 与合约交互

## 环境要求

- Node.js >= 18
- pnpm >= 8
- MetaMask浏览器扩展

## 命令

```bash
pnpm run dev          # 启动开发服务器
pnpm run build        # 生产构建
pnpm run preview      # 预览构建结果
pnpm run type-check   # TypeScript 类型检查
pnpm run test         # 运行 Playwright 测试 (headless)
pnpm run test:headed  # 运行 Playwright 测试 (显示浏览器)

# 工具脚本
pnpm tsx scripts/analyze-tx.ts <tx-hash>  # 分析交易详情和失败原因
```

## 技术栈

- React 18 + Vite 5
- **Viem 2.39** (EIP-7702标准SDK)
- TypeScript + CSS3

## EIP-7702 工作流程

### 3个核心步骤

1. **步骤1 - 签署授权**
   - Authorizer EOA 使用私钥签署 EIP-7702 授权消息
   - 指定要委托的 Delegation 合约地址
   - 生成授权签名 (chainId, nonce, r, s, v)

2. **步骤2 - 广播交易**
   - Relay 账户使用签署好的授权广播交易
   - 交易包含 `authorizationList` 发送到 Authorizer EOA 地址
   - 链上确认后，Delegation 合约代码绑定到 Authorizer EOA

3. **步骤3 - 验证执行**
   - Relay 直接向 Authorizer 地址发送交易
   - 调用 Delegation 合约的 `ping()` 函数
   - 验证授权成功，Gas 费用由 Relay 支付

### 撤回授权

- 发送授权到零地址 `0x0000...0000` 即可撤回
- EOA 恢复为普通账户状态
- 可重新授权其他合约

## 已部署合约

### Sepolia 测试网

| 合约 | 地址 | 功能 | Etherscan |
|------|------|------|-----------|
| **Basic Delegation** | `0x9381bbF662e415737FC33fecC71A660A6f642928` | initialize, ping | [查看](https://sepolia.etherscan.io/address/0x9381bbF662e415737FC33fecC71A660A6f642928) |
| **Sponsored Transfer** | `0x3bCC84C21BA32Dba8F3BE86F1E498778918e9B8F` | ETH 转账 | [查看](https://sepolia.etherscan.io/address/0x3bCC84C21BA32Dba8F3BE86F1E498778918e9B8F) |
| **Sponsored Transfer V2** | `0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05` | ETH + ERC20 转账 | [查看](https://sepolia.etherscan.io/address/0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05) |
| **Sponsored Transfer V2.1** 🔥 | 待部署 | MySBT 无 Gas 服务 | [文档](./docs/V2.1-SBT-GASLESS-SERVICE.md) |
| **MockERC20 (TUSDC)** | `0x202DAd7EbAC4282263174544605304500bFcbaF7` | 测试代币 | [查看](https://sepolia.etherscan.io/address/0x202DAd7EbAC4282263174544605304500bFcbaF7) |
| **MySBT** 🔐 | `0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C` | AAStar 身份 SBT | [查看](https://sepolia.etherscan.io/address/0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C) |

## 📚 深度文档

- **[EIP-7702 核心概念解析](./docs/EIP-7702-EXPLANATION.md)**
  - Relay 角色详解 (vs ERC-4337 Bundler)
  - SponsoredTransferDelegation 合约逐行解析
  - 完整执行流程图
  - 核心优势和应用场景

- **[Gas 成本详细分析](./docs/GAS-ANALYSIS.md)**
  - 传统 EOA vs EIP-7702 批量转账
  - 详细 gas 成本分解 (每一项都有计算)
  - **重要更正**: 实际节约约 37%，而非 60%
  - 不同数量的成本对比表
  - 实际应用建议

## 测试

项目包含 72 个 E2E 测试用例:

```bash
# 运行所有测试
pnpm test

# 在浏览器中运行测试
pnpm test:headed

# 查看测试报告
pnpm exec playwright show-report
```

测试覆盖:
- ✅ 页面加载和元素可见性
- ✅ 导航功能
- ✅ 表单输入和按钮状态
- ✅ 响应式设计 (桌面/平板/手机)
- ✅ 样式和布局

## License

MIT

## ⚠️ 技术说明：EIP-7702 撤销授权

关于 **编程方式撤销授权 (Programmatic Revoke)** 的调研结论：

### 1. 现状
目前 `@metamask/smart-accounts-kit` (v0.1.0) **不支持** 通过 SDK 函数直接撤销 EIP-7702 授权（即账户降级回 EOA）。

### 2. 分析
- **SDK 限制**: 虽然 `delegation-framework` 合约中存在 `disableDelegation` 函数，但它用于管理链下权限 (Offchain Delegations)，而非 EIP-7702 账户本身的升级/降级。
- **底层机制**: 真正的 EIP-7702 撤销需要发送一笔 `authorizationList` 指向零地址 (`0x00...00`) 的交易。目前 SDK 未封装此逻辑。
- **签名问题**: 尝试手动构建 EIP-7702 签名时，会遇到与 MetaMask `personal_sign` / `eth_signTypedData` 的兼容性问题。

### 3. 解决方案
本项目目前采用 **手动撤销** 方案，这是官方推荐且最稳定的路径：
1. 用户在 MetaMask 插件中打开账户详情
2. 点击 "智能账户" 设置
3. 手动关闭/撤销授权

### 4. 参考资源
- [MetaMask Smart Accounts Kit 文档](https://docs.metamask.io/smart-accounts-kit/)
- [Delegation Framework 仓库](https://github.com/MetaMask/delegation-framework)
- [EIP-7702 标准](https://eips.ethereum.org/EIPS/eip-7702)
