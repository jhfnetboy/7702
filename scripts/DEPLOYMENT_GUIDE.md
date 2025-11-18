# 部署指南 - MockERC20 & SponsoredTransferDelegationV2

## 📋 准备工作

### 1. 确保有 Sepolia ETH
- Relay 账户需要至少 0.05 ETH 用于部署
- 获取测试币：https://sepoliafaucet.com

### 2. 准备 MetaMask
- 导入 Relay 私钥到 MetaMask
- 切换到 Sepolia 测试网

---

## 🚀 使用 Remix IDE 部署

### Step 1: 打开 Remix
访问：https://remix.ethereum.org

### Step 2: 创建文件

#### 2.1 创建 MockERC20.sol
1. 在 Remix 左侧文件管理器中，创建新文件：`contracts/MockERC20.sol`
2. 复制 `/contracts/MockERC20.sol` 的内容粘贴进去

#### 2.2 创建 SponsoredTransferDelegationV2.sol
1. 创建新文件：`contracts/SponsoredTransferDelegationV2.sol`
2. 复制 `/contracts/SponsoredTransferDelegationV2.sol` 的内容粘贴进去

### Step 3: 编译合约

#### 3.1 编译 MockERC20
1. 点击左侧 "Solidity Compiler" 图标
2. 选择编译器版本：`0.8.20`
3. 点击 "Compile MockERC20.sol"
4. 确保编译成功（绿色勾）

#### 3.2 编译 SponsoredTransferDelegationV2
1. 点击 "Compile SponsoredTransferDelegationV2.sol"
2. 确保编译成功

### Step 4: 部署 MockERC20

1. 点击左侧 "Deploy & Run Transactions" 图标
2. Environment 选择：**Injected Provider - MetaMask**
3. 确认 MetaMask 连接到 **Sepolia**
4. Contract 选择：**MockERC20**
5. 填写构造函数参数：
   ```
   _NAME: "Test USDC"
   _SYMBOL: "TUSDC"
   _INITIALSUPPLY: 1000000
   ```
6. 点击 "Deploy"
7. MetaMask 确认交易
8. 等待交易确认
9. **复制合约地址**（在 Deployed Contracts 下方）

示例地址：`0x1234...abcd`

### Step 5: 部署 SponsoredTransferDelegationV2

1. Contract 选择：**SponsoredTransferDelegationV2**
2. 无需构造函数参数
3. 点击 "Deploy"
4. MetaMask 确认交易
5. 等待交易确认
6. **复制合约地址**

示例地址：`0x5678...efgh`

### Step 6: 验证合约（可选但推荐）

访问 Sepolia Etherscan 验证合约：

#### 6.1 验证 MockERC20
1. 访问：`https://sepolia.etherscan.io/address/[MockERC20地址]`
2. 点击 "Contract" → "Verify and Publish"
3. 填写：
   - Compiler Type: Solidity (Single file)
   - Compiler Version: v0.8.20
   - License: MIT
4. 粘贴 MockERC20.sol 的完整代码
5. Constructor Arguments (ABI-encoded):
   ```
   需要编码以下参数:
   "Test USDC", "TUSDC", 1000000
   ```
   使用 https://abi.hashex.org 编码
6. 提交验证

#### 6.2 验证 SponsoredTransferDelegationV2
1. 访问：`https://sepolia.etherscan.io/address/[V2地址]`
2. 点击 "Contract" → "Verify and Publish"
3. 填写相同配置
4. 粘贴 SponsoredTransferDelegationV2.sol 的完整代码
5. 无需 Constructor Arguments
6. 提交验证

---

## 📝 更新配置

### 更新 `.env` 文件

在项目根目录的 `.env` 文件中添加：

```bash
# MockERC20 Token Address (Sepolia)
VITE_MOCK_ERC20_ADDRESS=0x[你的MockERC20地址]

# SponsoredTransferV2 Contract Address (Sepolia)
VITE_SPONSORED_TRANSFER_V2_ADDRESS=0x[你的V2合约地址]
```

### Mint 测试代币

部署完成后，需要给 Authorizer 账户 mint 一些测试代币：

1. 在 Remix 中，找到已部署的 MockERC20 合约
2. 展开合约函数列表
3. 找到 `mint` 函数
4. 填写参数：
   ```
   to: [你的Authorizer地址，来自.env的VITE_AUTHORIZER]
   amount: 10000000000000000000000 (10000 * 10^18 = 10000 TUSDC)
   ```
5. 点击 "transact"
6. 确认交易

---

## ✅ 验证部署

### 1. 检查 MockERC20
```bash
# 在 Remix 或 Etherscan 上调用
balanceOf(Authorizer地址)
# 应该返回: 10000000000000000000000 (10000 TUSDC)

symbol()
# 应该返回: "TUSDC"

decimals()
# 应该返回: 18
```

### 2. 检查 SponsoredTransferDelegationV2
```bash
# 合约应该包含以下函数:
- transferETH
- batchTransfer
- transferERC20  ✅ 新增
- batchTransferERC20  ✅ 新增
- getERC20Balance  ✅ 新增
- getBalance
```

---

## 📊 部署结果记录

请填写实际部署的合约地址：

| 合约 | 地址 | Etherscan | 验证状态 |
|------|------|-----------|---------|
| MockERC20 | `0x...` | https://sepolia.etherscan.io/address/0x... | ⬜ 待验证 |
| SponsoredTransferV2 | `0x...` | https://sepolia.etherscan.io/address/0x... | ⬜ 待验证 |

---

## 🐛 常见问题

### Q1: MetaMask 提示 Gas 费用过高
A: 这是正常的，合约部署需要较多 Gas。确保账户有足够的 Sepolia ETH。

### Q2: 交易失败
A: 检查：
- MetaMask 是否连接到 Sepolia
- 账户是否有足够的 ETH
- 合约代码是否编译成功

### Q3: 验证合约失败
A: 确保：
- 编译器版本完全一致（0.8.20）
- 代码完全一致（包括空格和注释）
- License 选择正确（MIT）
- Constructor Arguments 编码正确

---

**部署完成后，继续执行 `npm run update-config` 更新前端配置**
