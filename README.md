# EIP-7702 Demo Application

简洁的Vite + React + Viem应用，演示EIP-7702的5个关键步骤。

## 功能

- MetaMask钱包连接与账户管理
- EIP-7702授权和合约委托演示
- Viem 2.39标准SDK使用
- Sepolia测试网集成

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
pnpm run dev          # 启动开发
pnpm run build        # 构建
pnpm run preview      # 预览
pnpm run type-check   # 类型检查
```

## 技术栈

- React 18 + Vite 5
- **Viem 2.39** (EIP-7702标准SDK)
- TypeScript + CSS3

## 5个EIP-7702步骤

1. **授权签署**: EOA签署委托授权
2. **合约指定**: 中继发送授权事务，指定合约
3. **初始化**: 调用合约初始化函数
4. **后续交互**: 无需授权，直接调用
5. **Gas赞助**: 所有费用由中继账户支付

## 部署步骤

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)
