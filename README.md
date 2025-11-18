# EIP-7702 Demo Application

完整的 EIP-7702 演示应用，展示 EOA 账户授权和智能合约委托的完整流程。

## 核心功能

- ✅ **完整的 EIP-7702 工作流**: 签署授权 → 广播交易 → 验证执行
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

- **Delegation Contract**: `0x9381bbF662e415737FC33fecC71A660A6f642928`
- **部署交易**: `0xfabd75b4bc546707add8f69a5fecf6bada09184efaafd38909112b9c910bea0e`
- **验证状态**: ✅ 已验证，包含 `initialize()` 和 `ping()` 函数

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
