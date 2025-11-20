# MetaMask Smart Account 部署指南

## 前置要求

- Node.js 18+
- pnpm 10.6+
- Foundry (forge)
- Sepolia 测试网 ETH

## 1. 环境配置

### 1.1 创建 .env 文件

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加必要的环境变量：

```env
# Sepolia RPC URL (Alchemy/Infura)
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# 部署账户私钥（需要 Sepolia ETH）
PRIVATE_KEY=0x...

# Relay 账户私钥（支付 Gas）
VITE_RELAY_PRIVATE_KEY=0x...

# Bundler URL (可选，使用 MetaMask 的 bundler)
VITE_BUNDLER_URL=https://bundler.sepolia.metamask.io

# Etherscan API Key (用于合约验证)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

## 2. 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装 Foundry 依赖
cd lib/delegation-framework
forge install
cd ../..
```

## 3. 部署 Enforcers

### 3.1 编译合约

```bash
forge build
```

### 3.2 部署到 Sepolia

```bash
# 加载环境变量
source .env

# 部署 Enforcers
forge script script/DeployEnforcers.s.sol \
  --rpc-url $VITE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# 记录输出的合约地址
# MySBTGatedEnforcer: 0x...
# BatchTransferEnforcer: 0x...
```

### 3.3 更新 shared-config

部署后需要更新 `@aastar/shared-config` 包以包含新部署的合约地址。

临时解决方案：更新 `src/config/shared-config-adapter.ts`：

```typescript
const TEMP_ADDRESSES: Record<ContractName, `0x${string}`> = {
  // ... 其他地址
  MySBTGatedEnforcer: '0x[部署的地址]',
  BatchTransferEnforcer: '0x[部署的地址]',
}
```

## 4. 启动应用

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build
pnpm preview
```

应用将在 http://localhost:5173 启动

## 5. 测试流程

### 5.1 准备测试账户

1. **Authorizer EOA**: 需要有 MySBT 和一些 ETH/代币
2. **Relay 账户**: 需要足够的 Sepolia ETH 支付 Gas

### 5.2 执行测试

1. **访问 MetaMask SDK 标签页**
   - 打开 http://localhost:5173
   - 点击 "MetaMask SDK" 标签

2. **创建 Smart Account**
   - 输入 Authorizer 私钥
   - 点击 "创建 Smart Account"
   - 等待账户创建完成

3. **设置委托权限**
   - 勾选 "需要 MySBT 验证"
   - 设置最大转账金额
   - 点击 "创建委托"

4. **执行批量转账**
   - 添加多个接收地址和金额
   - 点击 "执行 Gasless 批量转账"
   - 等待交易完成

### 5.3 验证结果

在 Sepolia Etherscan 查看交易：
- https://sepolia.etherscan.io/tx/[交易哈希]

## 6. 常见问题

### Q1: MySBT 验证失败

**原因**: Authorizer 账户没有 MySBT

**解决**:
1. 确认账户地址持有 MySBT
2. 在 Etherscan 验证: https://sepolia.etherscan.io/address/0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C

### Q2: Gas 不足

**原因**: Relay 账户 ETH 不足

**解决**:
1. 检查 Relay 账户余额
2. 从 Sepolia Faucet 获取测试 ETH: https://sepoliafaucet.com

### Q3: 合约未部署

**原因**: Enforcers 还没有部署到 Sepolia

**解决**:
1. 按照步骤 3 部署合约
2. 更新 shared-config-adapter.ts 中的地址

### Q4: Bundler 连接失败

**原因**: Bundler URL 不可用

**解决**:
1. 使用 MetaMask 官方 bundler: `https://bundler.sepolia.metamask.io`
2. 或设置自己的 bundler

## 7. 合约地址参考

### MetaMask 官方合约（Sepolia）

| 合约 | 地址 |
|------|------|
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| EIP7702StatelessDeleGator | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |

### AAStar 合约（Sepolia）

| 合约 | 地址 |
|------|------|
| MySBT | `0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C` |
| SponsoredTransferV2 | `0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05` |

### 自定义 Enforcers（需要部署）

| 合约 | 地址 | 状态 |
|------|------|------|
| MySBTGatedEnforcer | 待部署 | ⏳ |
| BatchTransferEnforcer | 待部署 | ⏳ |

## 8. 测试脚本

### 8.1 单元测试

```bash
# 运行合约测试
forge test

# 运行特定测试
forge test --match-contract MySBTGatedEnforcerTest -vvv

# 生成 Gas 报告
forge test --gas-report
```

### 8.2 前端测试

```bash
# 运行 Playwright 测试
pnpm test

# 带界面运行
pnpm test:headed
```

### 8.3 集成测试脚本

创建 `scripts/test-integration.ts`:

```typescript
import { privateKeyToAccount } from 'viem/accounts'
import { useMetaMaskSmartAccount } from '../src/hooks/useMetaMaskSmartAccount'

async function testIntegration() {
  const privateKey = process.env.TEST_PRIVATE_KEY as `0x${string}`
  const { createSmartAccount, createDelegation, executeBatchTransfer } = useMetaMaskSmartAccount()

  // 1. 创建 Smart Account
  const smartAccount = await createSmartAccount(privateKey)
  console.log('Smart Account:', smartAccount.address)

  // 2. 创建委托
  const delegation = await createDelegation({
    delegator: smartAccount.address,
    delegate: '0x...', // Relay 地址
    privateKey,
    requireMySBT: true,
  })
  console.log('Delegation created:', delegation)

  // 3. 执行批量转账
  const result = await executeBatchTransfer({
    smartAccount,
    recipients: [
      { address: '0x...', amount: parseEther('0.1') },
      { address: '0x...', amount: parseEther('0.2') },
    ],
  })
  console.log('Batch transfer:', result)
}

testIntegration().catch(console.error)
```

运行测试：

```bash
pnpm tsx scripts/test-integration.ts
```

## 9. 监控和日志

### 9.1 启用详细日志

在浏览器控制台查看详细日志：
- 打开开发者工具 (F12)
- 查看 Console 标签
- 过滤 "Smart Account" 或 "Delegation"

### 9.2 交易追踪

使用 Tenderly 或 Etherscan 追踪交易：
1. 获取交易哈希
2. 在 Etherscan 查看: https://sepolia.etherscan.io/tx/[hash]
3. 查看 Internal Transactions 了解委托执行

## 10. 生产部署注意事项

### 安全考虑

1. **私钥管理**: 生产环境绝不在前端存储私钥
2. **合约审计**: 部署前进行安全审计
3. **权限控制**: 严格限制 Enforcer 权限
4. **监控告警**: 设置异常交易监控

### 性能优化

1. **批量大小**: 限制单次批量转账数量（建议 < 50）
2. **Gas 估算**: 准确估算 Gas，避免失败
3. **缓存优化**: 缓存 Smart Account 实例

### 多链部署

MetaMask Delegation Framework 支持多链：
- Ethereum Mainnet
- Polygon
- Base
- Arbitrum
- Optimism

更新 `viem/chains` 和 RPC URL 即可支持其他链。

## 下一步

1. ✅ 完成 Enforcers 部署
2. ✅ 更新 shared-config
3. ✅ 完成集成测试
4. 📝 申请 MetaMask 早期合作伙伴
5. 🚀 部署到主网

## 联系支持

- GitHub Issues: https://github.com/MetaMask/delegation-framework/issues
- Discord: MetaMask 开发者社区
- 文档: https://docs.metamask.io/delegation-toolkit/