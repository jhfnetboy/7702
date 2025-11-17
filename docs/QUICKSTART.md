# 快速开始

## 5分钟启动EIP-7702演示

### 1. 安装依赖
```bash
pnpm install
```

### 2. 配置环境
```bash
cp .env.example .env
# 编辑.env，填入：
# - VITE_SEPOLIA_RPC_URL（来自Alchemy）
# - VITE_RELAY_PRIVATE_KEY（中继账户，支付gas）
# - VITE_DELEGATION_CONTRACT_ADDRESS（部署后填入）
```

### 3. 部署合约（可选）
```bash
# 使用Hardhat部署contracts/Delegation.sol到Sepolia
# 记录合约地址，填入.env的VITE_DELEGATION_CONTRACT_ADDRESS
```

### 4. 启动应用
```bash
pnpm run dev
```

应用将在 `http://localhost:5173` 打开

## 使用演示

### Dashboard页面
1. 点击"Connect MetaMask"
2. 选择账户，查看地址和余额
3. 配置授权者地址（选中复选框）

### EIP-7702 Demo页面
1. 输入授权者私钥
2. 点击"Initialize Contract"
   - 创建授权
   - 中继发送交易
   - 合约被委托
3. 点击"Ping Delegated Contract"
   - 后续交互，无需授权
   - 中继继续支付gas

## 按照Viem文档的5个步骤

```
步骤1: 签署授权
        const authorization = await walletClient.signAuthorization({
          account: eoa,
          contractAddress
        })

步骤2: 发送初始化交易（带授权）
        await walletClient.sendTransaction({
          authorizationList: [authorization],
          data: encodeFunctionData({ abi, functionName: 'initialize' }),
          to: eoa.address
        })

步骤3-4: 后续交互（无需授权）
        await walletClient.sendTransaction({
          data: encodeFunctionData({ abi, functionName: 'ping' }),
          to: eoa.address
        })

步骤5: Gas赞助
        所有交易费用由中继账户支付
```

## 获取测试ETH

- [Alchemy Faucet](https://sepoliafaucet.com/) - 给中继账户充值Sepolia ETH

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/config/viem.ts` | Viem客户端配置（中继账户） |
| `src/hooks/useEIP7702.ts` | EIP-7702操作（5个步骤） |
| `src/hooks/useMetaMask.ts` | MetaMask连接 |
| `src/components/EIP7702Demo.tsx` | 演示UI |
| `contracts/Delegation.sol` | 示例合约 |

## 故障排除

**无法连接MetaMask**
- 确保安装了MetaMask扩展
- 刷新页面

**交易失败**
- 检查中继账户是否有足够Sepolia ETH
- 验证合约地址是否正确

## 更多信息

- [Viem EIP-7702文档](https://viem.sh/docs/eip7702/sending-transactions)
- [完整部署指南](./DEPLOYMENT.md)
