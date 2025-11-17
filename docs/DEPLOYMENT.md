# 部署步骤

## 1. 部署Delegation.sol合约

使用Hardhat：

```bash
# 创建Hardhat项目
mkdir eip7702-contracts && cd eip7702-contracts
npx hardhat init

# 复制contracts/Delegation.sol文件到当前项目

# 部署
npx hardhat run scripts/deploy.js --network sepolia
```

记录输出的合约地址。

## 2. 配置.env

```bash
cp .env.example .env
```

填入以下内容：

```env
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
VITE_RELAY_PRIVATE_KEY=0x...    # 中继账户（支付gas）
VITE_DELEGATION_CONTRACT_ADDRESS=0x...  # 步骤1的合约地址
```

## 3. 启动应用

```bash
pnpm install
pnpm run dev
```

## 账户设置

需要2个账户：

| 账户 | 作用 | 需要 |
|------|------|------|
| 中继 | 支付gas | RELAY_PRIVATE_KEY |
| 授权者 | 被委托 | 在UI配置 |

## 获取测试ETH

- [Alchemy Faucet](https://sepoliafaucet.com/)
- [QuickNode Faucet](https://faucet.quicknode.com/sepolia)
