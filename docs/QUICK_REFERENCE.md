# EIP-7702 Demo - 快速参考卡片

## 🚀 30秒快速开始

```bash
cd projects/7702
pnpm install
pnpm run dev
# 打开: http://localhost:5173 → "EIP-7702 Demo" 标签
```

---

## 📋 核心概念速查

| 概念 | 说明 | 对应代码 |
|------|------|--------|
| **Authorizer** | 签署授权的EOA账户 | `VITE_AUTHORIZER` |
| **Relay** | 广播交易并支付Gas的账户 | `VITE_RELAY` |
| **Delegation** | 被委托的智能合约 | `VITE_DELEGATION_CONTRACT_ADDRESS` |

---

## 🔧 常用命令

```bash
# 开发
pnpm run dev          # 启动开发服务器

# 构建和验证
pnpm run type-check   # TypeScript类型检查
pnpm run build        # 构建生产版本
pnpm run preview      # 预览生产版本

# 安装依赖
pnpm install          # 安装所有依赖
pnpm add <package>    # 添加新依赖
```

---

## 📁 重要文件位置

```
.env                           # 环境变量配置 🔐
src/components/EIP7702Demo.tsx # 主演示组件 ⭐
src/config/viem.ts            # Viem初始化 ⚙️
src/hooks/useEIP7702.ts       # 核心逻辑 🔑
src/config/contract.ts        # 合约ABI 📜
```

---

## ⚙️ 环境变量配置

```bash
# 编辑 .env 文件

VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_RELAY=0xE3D28Aa77c95d5C098170698e5ba68824BFC008d
VITE_AUTHORIZER=0x92a30Ef64b0b750220B2b3BAFE4F3121263d45b3
VITE_DELEGATION_CONTRACT_ADDRESS=0x[部署后的合约地址]
```

---

## 🔄 EIP-7702 工作流

### 前置准备
```
获取 Authorizer 私钥
    ↓
输入到密码字段（不存储在ENV）
    ↓
输入 Delegation 合约地址
```

### 3个步骤

**Step 1: 签署授权**
```
输入私钥 → 创建EOA → 签署授权消息
```

**Step 2: Relay广播交易**
```
使用授权 → 调用sendTransaction()
→ 获得交易哈希 → 提交到链上
```

**Step 3: 验证执行**
```
调用合约ping()函数 → 验证委托生效
→ 查看Etherscan确认
```

---

## 💡 代码片段

### 如何使用私钥创建账户
```typescript
const { privateKeyToAccount } = await import('viem/accounts')
const eoa = privateKeyToAccount(privateKeyHex as `0x${string}`)
// eoa.address → 账户地址
```

### 如何签署授权
```typescript
const auth = await walletClient.signAuthorization({
  account: eoa,
  contractAddress: contractAddress,
})
// auth → 授权对象
```

### 如何广播事务
```typescript
const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: encodedData,
  to: targetAddress,
})
// hash → 交易哈希
```

---

## 🐛 常见问题速解

| 问题 | 解决方案 |
|------|--------|
| "缺少授权者私钥" | 在密码字段输入私钥 |
| "签署授权失败" | 检查私钥格式（0x开头，66字符） |
| "广播交易失败" | 确保Relay有足够的Sepolia ETH |
| "验证失败" | 确保前两步完成，合约地址正确 |
| "无法连接RPC" | 检查Alchemy API Key和网络 |

---

## 📊 关键指标

| 指标 | 值 |
|------|-----|
| TypeScript类型检查 | ✅ 通过 |
| 构建时间 | 6.2s |
| Bundle大小 | 128.5 kB (gzip) |
| 开发服务器启动 | <1s |

---

## 🔗 重要链接

- 🌍 **应用地址**: http://localhost:5173
- 📖 **EIP-7702标准**: https://eips.ethereum.org/EIPS/eip-7702
- 📚 **Viem文档**: https://viem.sh/
- 🧪 **Sepolia测试网**: https://sepolia.etherscan.io/
- 💧 **Sepolia Faucet**: https://www.infura.io/faucet/sepolia

---

## 👤 测试账户

```
Relay账户:
  地址: 0xE3D28Aa77c95d5C098170698e5ba68824BFC008d
  私钥: 0xb7caab91d7023458617f46d6cc9eb47538c8632d655b90752267b437bac8be43

Authorizer账户:
  地址: 0x92a30Ef64b0b750220B2b3BAFE4F3121263d45b3
  私钥: 0x015cc1577bb8dcc6635eff3e35bbc57c6d927fa31874b82a89fb3a42492f44b0
```

⚠️ **注意**: 测试账户仅用于演示，不包含真实资产

---

## 📚 文档速查

| 文档 | 内容 |
|------|------|
| README.md | 项目概览 |
| QUICKSTART.md | 5分钟快速开始 |
| DEPLOYMENT.md | 合约部署指南 |
| IMPLEMENTATION_SUMMARY.md | 技术细节 |
| VERIFICATION_REPORT.md | 完整验证 |
| FINAL_SUMMARY.md | 项目总结 |

---

## ✨ 快速修改指南

### 改变Relay账户
```typescript
// src/config/viem.ts
const relay = privateKeyToAccount(process.env.RELAY_PRIVATE_KEY)
// ↓
// const relay = privateKeyToAccount('0xYourPrivateKeyHere')
```

### 改变RPC端点
```bash
# .env
VITE_SEPOLIA_RPC_URL=https://your-rpc-url
```

### 更新合约ABI
```typescript
// src/config/contract.ts
export const delegationAbi = [
  // 添加或修改函数定义
]
```

### 修改UI文案
```tsx
// src/components/EIP7702Demo.tsx
<h2>EIP-7702 演示应用</h2>
// ↓
// <h2>Your Custom Title</h2>
```

---

## 🔐 安全检查清单

- [ ] .env 已配置，但不提交到git
- [ ] 私钥未硬编码在源代码中
- [ ] VITE_前缀仅用于公开信息
- [ ] 用户输入经过验证
- [ ] 不在浏览器console暴露私钥

---

## 📱 UI组件导航

```
App
├── Dashboard (MetaMask连接)
└── EIP-7702 Demo ⭐
    ├── 账户信息展示
    │   ├── Relay地址
    │   └── Authorizer地址
    │
    ├── 参数输入区
    │   ├── 授权者私钥 (密码字段)
    │   └── Delegation合约地址
    │
    ├── 3步流程卡片
    │   ├── Step 1: 签署授权
    │   ├── Step 2: Relay广播
    │   └── Step 3: 验证执行
    │
    └── 结果展示
        └── 成功后显示最终信息
```

---

## 🎯 使用场景

### 场景1: 学习EIP-7702
1. 阅读 README.md 了解概念
2. 运行 demo 理解工作流
3. 查看 Etherscan 验证交易

### 场景2: 演示项目
1. 准备好Sepolia账户和ETH
2. 启动应用
3. 步骤演示给观众

### 场景3: 开发测试
1. 修改合约代码
2. 重新部署
3. 更新合约地址
4. 重新测试

---

## 🚨 故障排除快速查询

```
错误                          → 原因               → 解决方案
"缺少授权者私钥"              → 未输入私钥         → 输入私钥
"签署授权失败"                → 私钥无效           → 检查格式
"广播交易失败"                → Gas不足            → 获取Sepolia ETH
"验证失败"                    → 合约地址错误       → 重新检查
"无法连接RPC"                 → API Key无效        → 更新Key
```

---

## 💾 保存配置

备份重要信息:
```bash
# 保存当前.env
cp .env .env.backup

# 保存私钥（安全存储）
# Relay Private Key: ...
# Authorizer Private Key: ...

# 保存部署的合约地址
# VITE_DELEGATION_CONTRACT_ADDRESS: 0x...
```

---

## 🔄 工作流快速切换

```bash
# 切换到项目目录
cd /Users/jason/Dev/mycelium/my-exploration/projects/7702

# 快速启动（如果已安装依赖）
pnpm run dev

# 快速构建
pnpm run build

# 快速类型检查
pnpm run type-check
```

---

**⏱️ 这份卡片应该在30秒内找到大部分答案！**

需要更详细的信息？查看对应的完整文档。
