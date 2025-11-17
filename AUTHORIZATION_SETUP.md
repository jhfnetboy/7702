# EIP-7702 Authorization Manager - Setup Guide

## 概述

这是一个基于 Viem SDK 的 EIP-7702 授权管理单页应用，允许用户通过 MetaMask 连接 EOA（外部拥有账户），并管理合约委托授权。

### 核心功能

1. ✅ **MetaMask 连接** - 连接以太坊钱包
2. ✅ **授权状态检查** - 自动检测 EOA 是否已授权委托合约
3. ✅ **签署授权** - 使用 relay 账户支付 gas，让 EOA 签署授权
4. ✅ **撤销授权** - 将授权设置为 0x00...00 地址以撤销
5. ✅ **Etherscan 集成** - 直接查看合约地址和交易详情

## 技术架构

### 技术栈
- **前端框架**: SvelteKit + TypeScript
- **区块链库**: Viem 2.x (支持 EIP-7702)
- **样式**: Tailwind CSS
- **网络**: Sepolia 测试网

### 工作流程

```
用户连接 MetaMask
    ↓
检查 EOA 授权状态 (getCode)
    ↓
┌─────────────────┬──────────────────┐
│   未授权        │    已授权        │
│                 │                  │
│ 1. 输入合约地址  │ 1. 显示委托地址   │
│ 2. EOA 签署授权  │ 2. 显示 Etherscan │
│ 3. Relay 支付gas │ 3. 可撤销授权     │
└─────────────────┴──────────────────┘
```

## 快速开始

### 1. 环境配置

创建 `.env` 文件（参考 `.env.example`）:

```bash
# Alchemy API Key (必需)
VITE_ALCHEMY_API_KEY=your_alchemy_api_key_here

# Relay 账户私钥 (必需 - 用于支付 gas)
VITE_RELAY_PRIVATE_KEY=0x<your_private_key_here>
```

**重要提示**:
- **开发环境**: 在 `.env` 文件中配置
- **生产环境**: 通过服务器端配置注入
- ⚠️ **永远不要将真实私钥提交到版本控制!**

### 2. 准备 Relay 账户

Relay 账户用于支付 EIP-7702 授权交易的 gas 费用。

**开发环境步骤**:
1. 创建一个新的以太坊测试账户
2. 在 Sepolia 测试网获取一些测试 ETH
   - [Sepolia Faucet 1](https://sepoliafaucet.com/)
   - [Sepolia Faucet 2](https://www.alchemy.com/faucets/ethereum-sepolia)
3. 将私钥添加到 `.env` 文件的 `VITE_RELAY_PRIVATE_KEY`

### 3. 安装依赖

```bash
pnpm install
```

### 4. 启动开发服务器

```bash
pnpm dev
```

应用将在 http://localhost:5173 启动

### 5. 访问授权管理页面

打开浏览器访问:
```
http://localhost:5173/authorization
```

## 使用指南

### 场景 1: 首次授权

1. **连接 MetaMask**
   - 点击 "Connect MetaMask" 按钮
   - 在 MetaMask 中确认连接

2. **检查状态**
   - 页面自动检查您的 EOA 授权状态
   - 如果未授权，会显示授权表单

3. **签署授权**
   - 输入委托合约地址（默认已填充 BatchCallDelegation 合约）
   - 点击 "Sign Authorization" 按钮
   - 在 MetaMask 中签署授权消息（**不需要支付 gas!**）
   - 等待 relay 账户提交交易

4. **确认授权**
   - 交易成功后，页面会显示授权信息
   - 可以点击 Etherscan 链接查看合约详情

### 场景 2: 撤销授权

1. **查看当前授权**
   - 连接 MetaMask 后，页面显示当前授权的合约地址

2. **撤销授权**
   - 点击 "Revoke Authorization" 按钮
   - 确认撤销操作
   - 在 MetaMask 中签署撤销消息
   - 等待交易确认

3. **验证撤销**
   - 页面更新为"未授权"状态
   - 可以重新设置新的授权

## 代码结构

```
src/
├── lib/
│   └── authorizationManager.ts    # 授权管理核心逻辑
└── routes/
    └── authorization/
        └── +page.svelte            # 授权管理页面 UI
```

### 核心函数 (authorizationManager.ts)

#### `checkAuthorizationStatus(eoaAddress)`
检查 EOA 的授权状态

**原理**: 使用 `publicClient.getCode(address)` 读取账户代码
- 返回 `0x` 或 `null` → 未授权
- 返回其他值 → 已授权，并解析委托合约地址

#### `signAuthorization(eoaAddress, delegationContract)`
签署授权，委托合约代码到 EOA

**流程**:
1. EOA 通过 MetaMask 签署授权消息 (`signAuthorization`)
2. Relay 账户构建并提交包含 `authorizationList` 的交易
3. Relay 账户支付所有 gas 费用

#### `revokeAuthorization(eoaAddress)`
撤销授权

**原理**: 将授权设置为零地址 (`0x00...00`)，清除 EOA 的委托代码

## EIP-7702 技术细节

### 授权格式

EIP-7702 在 EOA 地址存储的代码格式为:
```
0xef0100<20-byte-contract-address>
```

示例:
```
0xef01006987E30398b2896B5118ad1076fb9f58825a6f1a
         └─────────────────┬─────────────────┘
              委托合约地址
```

### 交易类型

- **类型**: `0x04` (EIP-7702 交易)
- **关键字段**: `authorizationList` - 包含 EOA 的授权签名

### Relay 模式的优势

1. **用户体验**: EOA 用户无需持有 ETH 即可设置授权
2. **gas 赞助**: Relay 账户承担所有 gas 费用
3. **安全性**: EOA 仅签署授权，不暴露私钥

## 安全注意事项

⚠️ **重要安全提示**:

1. **私钥保护**
   - 永远不要在前端代码中硬编码私钥
   - 使用环境变量管理私钥
   - 生产环境使用服务器端配置

2. **Relay 账户**
   - Relay 账户仅用于支付 gas
   - 不控制用户资产
   - 定期检查余额，及时充值

3. **授权验证**
   - 用户应验证委托合约地址的正确性
   - 可以通过 Etherscan 查看合约代码
   - 不要授权未知或未验证的合约

4. **测试网使用**
   - 开发和测试请使用 Sepolia 测试网
   - 不要在测试网使用真实资产的私钥

## 故障排除

### 问题 1: "MetaMask is not installed"
**解决方案**: 安装 [MetaMask](https://metamask.io/) 浏览器扩展

### 问题 2: "Relay account not configured"
**解决方案**: 检查 `.env` 文件中的 `VITE_RELAY_PRIVATE_KEY` 配置

### 问题 3: 交易失败 - "insufficient funds"
**解决方案**: Relay 账户余额不足，需要在 Sepolia 测试网充值 ETH

### 问题 4: MetaMask 网络错误
**解决方案**: 确保 MetaMask 切换到 Sepolia 测试网

### 问题 5: 授权状态未更新
**解决方案**: 点击 "Refresh Status" 按钮手动刷新

## 下一步

完成基础授权管理后，可以探索:

1. **批量转账**: 使用已授权的 EOA 执行批量转账
2. **自定义合约**: 部署自己的委托合约
3. **高级功能**: 实现 gas 赞助、批量操作等

## 参考资料

- [EIP-7702 规范](https://eips.ethereum.org/EIPS/eip-7702)
- [Viem EIP-7702 文档](https://viem.sh/docs/eip7702/sending-transactions)
- [项目技术文档](./CLAUDE.md)

## 技术支持

如遇问题，请查看:
- 浏览器控制台日志
- MetaMask 活动记录
- Sepolia Etherscan 交易详情

---

**版本**: 1.0.0
**最后更新**: 2025-11-17
**网络**: Sepolia Testnet
