# EIP-7702 Gasless Delegation 产品重构方案

> 基于 MetaMask Smart Accounts Kit 最佳实践

## 📋 执行摘要

当前实现存在与 MetaMask 最佳实践不符的问题。根据官方文档分析，我们需要：

1. ❌ **停止**手动调用 `signAuthorization` 和创建 Smart Account
2. ✅ **改用** EIP-5792 `sendCalls` + ERC-7715 `requestExecutionPermissions`
3. ✅ **保留** Custom Caveat Enforcers (这是正确的业务逻辑实现方式)
4. ✅ **新增** 自定义 Paymaster 服务（MySBT + ERC20 gasless）

---

## 🔍 问题分析

### 当前架构的误区

| 组件 | 当前做法 | 问题 | 正确做法 |
|------|---------|------|---------|
| Account 升级 | 手动调用 `toMetaMaskSmartAccount` | RPC 不支持，用户体验差 | 被动触发 MetaMask 原生升级 UI |
| 授权签署 | 手动 `signAuthorization` | 接口不存在 | 通过 `sendCalls` 或 `requestExecutionPermissions` 触发 |
| 委托创建 | EIP-712 `signTypedData` | 非标准流程 | ERC-7715 `requestExecutionPermissions` |
| 交易执行 | 直接调用 `bundlerClient.sendUserOperation` | 绕过 MetaMask 封装 | EIP-5792 `sendCalls` |

### 核心误解

**❌ 误解**：我们需要让用户的 EOA 升级到"我们的"Smart Account 合约

**✅ 真相**：
- MetaMask 只允许升级到官方的 `EIP7702StatelessDeleGator`
- 我们的业务逻辑通过 **Caveat Enforcer** 实现
- 我们不是"替换"账户，而是"请求带规则的权限"

---

## 🏗️ 新架构设计

### 1. 技术栈更新

```typescript
// 新增依赖
import { erc5792Actions } from 'viem/experimental'
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental'

// WalletClient 配置
const walletClient = createWalletClient({
  transport: custom(window.ethereum)
})
  .extend(erc5792Actions())       // 批量交易
  .extend(erc7715ProviderActions()) // 权限请求
```

### 2. 用户流程重构

#### **旧流程（错误）**
```
1. 用户连接钱包
2. Dapp 调用 createSmartAccount → 手动升级
3. Dapp 调用 signAuthorization → 失败
4. Dapp 手动创建 Delegation
5. Dapp 构建 UserOp → Bundler
```

#### **新流程（正确）**
```
1. 用户连接钱包
2. Dapp 调用 requestExecutionPermissions (ERC-7715)
   ↓ MetaMask 检测到用户是 EOA
   ↓ MetaMask 弹窗："切换到 Smart Account"
   ↓ 用户确认 → 自动完成 EIP-7702 升级
   ↓ MetaMask 显示权限规则（Caveats）
   ↓ 用户签署 Delegation
3. Dapp 拿到 Permission 对象（包含签名）
4. 用户操作时，Dapp 调用 sendCalls (EIP-5792)
   ↓ MetaMask 封装 UserOp
   ↓ 自动调用 Bundler + Paymaster
```

### 3. 组件重构对照表

| 文件 | 重构方式 | 优先级 |
|------|---------|--------|
| `useMetaMaskSmartAccount.ts` | **大改** - 删除手动升级逻辑，改用标准 API | 🔴 高 |
| `MetaMaskSmartAccount.tsx` | **中改** - 简化 UI，移除"创建账户"步骤 | 🟡 中 |
| `MySBTGatedEnforcer.sol` | **保留** - 正确的实现方式 | 🟢 低 |
| `BatchTransferEnforcer.sol` | **保留** - 正确的实现方式 | 🟢 低 |
| 新增：`MySbtPaymaster.sol` | **新建** - 自定义 Paymaster | 🔴 高 |
| 新增：`CustomERC20.sol` | **新建** - 支持白名单扣款 | 🔴 高 |
| 新增：`paymaster-service/` | **新建** - 后端签名服务 | 🔴 高 |

---

## 📝 详细实现计划

### Phase 1: Hook 层重构 (useMetaMaskSmartAccount.ts)

#### **删除的方法**
```typescript
❌ createSmartAccount()         // 不再需要手动创建
❌ signAuthorization()           // RPC 不支持
❌ createDelegation()            // 改用 ERC-7715
❌ executeGaslessOperation()     // 改用 EIP-5792
```

#### **新增的方法**
```typescript
✅ requestPermissions(params: {
  requireMySBT: boolean
  maxAmount: bigint
  validityPeriod: number
}) → Promise<Permission>

✅ batchTransfer(params: {
  recipients: Recipient[]
  usePaymaster: boolean
}) → Promise<Hash>

✅ checkCapabilities() → Promise<Capabilities>
```

#### **核心代码示例**

```typescript
// 新的 useMetaMaskSmartAccount.ts

import { createWalletClient, custom } from 'viem'
import { sepolia } from 'viem/chains'
import { erc5792Actions } from 'viem/experimental'
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental'

export function useMetaMaskSmartAccount() {
  // 创建扩展的 WalletClient
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum!)
  })
    .extend(erc5792Actions())
    .extend(erc7715ProviderActions())

  /**
   * 步骤1: 请求权限（自动触发升级）
   */
  const requestPermissions = async (params: {
    delegate: Address          // Session Key 地址
    requireMySBT: boolean
    maxAmount?: bigint
    validityPeriod?: number    // 秒
  }) => {
    const permissions = await walletClient.requestExecutionPermissions([{
      chainId: `0x${sepolia.id.toString(16)}`,
      expiry: Math.floor(Date.now() / 1000) + (params.validityPeriod || 86400),
      signer: {
        type: 'account',
        data: { address: params.delegate }
      },
      permissions: [
        // MySBT Caveat
        ...(params.requireMySBT ? [{
          type: 'custom-caveat',
          data: {
            enforcer: CONTRACTS.mySBTEnforcer,
            terms: '0x'
          }
        }] : []),

        // Amount Limit Caveat
        ...(params.maxAmount ? [{
          type: 'erc20-token-periodic',
          data: {
            tokenAddress: '0x...', // 你的 ERC20
            periodAmount: params.maxAmount,
            periodDuration: 86400
          }
        }] : [])
      ]
    }])

    return permissions
  }

  /**
   * 步骤2: 执行批量转账（Gasless）
   */
  const batchTransfer = async (params: {
    recipients: Array<{ address: Address; amount: bigint; token?: Address }>
    paymasterUrl?: string
  }) => {
    // 构建批量调用
    const calls = params.recipients.map(r => ({
      to: r.token || r.address,
      value: r.token ? 0n : r.amount,
      data: r.token
        ? encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [r.address, r.amount]
          })
        : '0x'
    }))

    // 使用 EIP-5792 sendCalls
    const txHash = await walletClient.sendCalls({
      calls,
      capabilities: params.paymasterUrl ? {
        paymasterService: {
          url: params.paymasterUrl
        }
      } : undefined
    })

    return txHash
  }

  /**
   * 检查钱包能力
   */
  const checkCapabilities = async () => {
    const capabilities = await walletClient.getCapabilities()

    return {
      supportsAtomicBatch: !!capabilities[sepolia.id]?.atomicBatch,
      supportsPaymaster: !!capabilities[sepolia.id]?.paymasterService
    }
  }

  return {
    requestPermissions,
    batchTransfer,
    checkCapabilities,
    contracts: CONTRACTS
  }
}
```

---

### Phase 2: Paymaster 实现

#### **架构图**

```
┌─────────────┐
│  前端 Dapp  │
└──────┬──────┘
       │ 1. 构建 UserOp
       ↓
┌─────────────────────┐
│ Paymaster Service   │ ← 2. 检查 SBT, 签名
│ (Node.js 后端)       │
└──────┬──────────────┘
       │ 3. 返回 paymasterAndData
       ↓
┌─────────────────────┐
│   Bundler           │
└──────┬──────────────┘
       │ 4. 提交到链上
       ↓
┌─────────────────────┐
│  EntryPoint         │
│    ↓                │
│  MySbtPaymaster     │ ← 5. 验证签名
│    ↓                │
│  CustomERC20        │ ← 6. 扣除 Token (无需 approve)
│    ↓                │
│  DelegationManager  │
│    ↓                │
│  MySBTGatedEnforcer │ ← 7. 验证 SBT (链上)
│    ↓                │
│  目标合约            │
└─────────────────────┘
```

#### **合约代码**

##### 1. CustomERC20.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * 支持 Paymaster 白名单的自定义 ERC20
 * Paymaster 可以无需 approve 直接扣除用户余额
 */
contract CustomERC20 is ERC20, Ownable {
    // 白名单 Paymaster 地址
    mapping(address => bool) public isWhitelistedPaymaster;

    event PaymasterWhitelisted(address indexed paymaster, bool status);

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {}

    /**
     * 设置 Paymaster 白名单
     */
    function setPaymaster(address paymaster, bool status) external onlyOwner {
        isWhitelistedPaymaster[paymaster] = status;
        emit PaymasterWhitelisted(paymaster, status);
    }

    /**
     * Paymaster 专用：无需 allowance 扣款
     * @param from 用户地址
     * @param amount 扣除数量
     */
    function paymasterBurn(address from, uint256 amount) external {
        require(isWhitelistedPaymaster[msg.sender], "Not authorized paymaster");
        _burn(from, amount);
        // 或者转给收款地址：_transfer(from, treasury, amount);
    }

    /**
     * 批量铸造（用于测试）
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }
}
```

##### 2. MySbtPaymaster.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ICustomERC20 {
    function paymasterBurn(address from, uint256 amount) external;
}

/**
 * MySBT Gated Paymaster
 *
 * 流程：
 * 1. 后端检查用户是否持有 MySBT
 * 2. 后端签名 UserOpHash
 * 3. 链上验证签名
 * 4. 扣除用户 ERC20（无需 approve）
 * 5. Paymaster 代付 Gas
 */
contract MySbtPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public verifyingSigner;
    ICustomERC20 public token;
    uint256 public tokenPerEth; // 例如：1 ETH = 2000 Token

    event UserOpSponsored(address indexed sender, uint256 tokenCharged);

    constructor(
        address _entryPoint,
        address _verifyingSigner,
        address _token,
        uint256 _tokenPerEth
    ) BasePaymaster(IEntryPoint(_entryPoint)) {
        verifyingSigner = _verifyingSigner;
        token = ICustomERC20(_token);
        tokenPerEth = _tokenPerEth;
    }

    /**
     * 验证 Paymaster UserOp
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // 解析 paymasterAndData
        // 格式: [paymaster address (20)][validUntil (6)][validAfter (6)][signature (65)]
        (uint48 validUntil, uint48 validAfter, bytes memory signature) =
            parsePaymasterAndData(userOp.paymasterAndData);

        // 验证后端签名
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recovered = hash.recover(signature);

        if (recovered != verifyingSigner) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        // 计算需要扣除的 Token 数量
        uint256 tokenAmount = (maxCost * tokenPerEth) / 1 ether;

        // 扣除 Token（预扣费）
        try token.paymasterBurn(userOp.sender, tokenAmount) {
            // 成功
            emit UserOpSponsored(userOp.sender, tokenAmount);
        } catch {
            // 余额不足或其他错误
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        // 返回上下文（用于 postOp 退款）
        return (
            abi.encode(userOp.sender, tokenAmount, maxCost),
            _packValidationData(false, validUntil, validAfter)
        );
    }

    /**
     * 交易后处理（可选：精确退款）
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        // 根据 actualGasCost 计算实际 Token 消耗
        // 将多扣的 Token 退回给用户
        // （简化版本可以不实现退款，稍微多扣一点作为服务费）
    }

    /**
     * 解析 PaymasterAndData
     */
    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes memory signature)
    {
        // paymasterAndData 格式:
        // [0:20]   paymaster address
        // [20:26]  validUntil (uint48)
        // [26:32]  validAfter (uint48)
        // [32:97]  signature (65 bytes)

        validUntil = uint48(bytes6(paymasterAndData[20:26]));
        validAfter = uint48(bytes6(paymasterAndData[26:32]));
        signature = paymasterAndData[32:];
    }

    /**
     * 存款（Paymaster 需要在 EntryPoint 存押金）
     */
    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * 更新汇率
     */
    function setTokenPerEth(uint256 _tokenPerEth) external onlyOwner {
        tokenPerEth = _tokenPerEth;
    }

    /**
     * 更新签名者
     */
    function setVerifyingSigner(address _signer) external onlyOwner {
        verifyingSigner = _signer;
    }
}
```

##### 3. Paymaster Service (Node.js)

```typescript
// paymaster-service/src/index.ts

import express from 'express'
import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const app = express()
app.use(express.json())

// 配置
const PAYMASTER_PRIVATE_KEY = process.env.PAYMASTER_SIGNER_KEY as `0x${string}`
const MY_SBT_ADDRESS = '0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C'
const PAYMASTER_ADDRESS = '0x...' // 部署的 MySbtPaymaster 地址

const signer = privateKeyToAccount(PAYMASTER_PRIVATE_KEY)

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
})

/**
 * POST /api/sponsor
 *
 * Body: {
 *   userOp: PackedUserOperation,
 *   userOpHash: Hash
 * }
 */
app.post('/api/sponsor', async (req, res) => {
  try {
    const { userOp, userOpHash } = req.body

    // 1. 验证用户是否持有 MySBT
    const sbtBalance = await publicClient.readContract({
      address: MY_SBT_ADDRESS,
      abi: parseAbi(['function getUserSBT(address) view returns (uint256)']),
      functionName: 'getUserSBT',
      args: [userOp.sender]
    })

    if (sbtBalance === 0n) {
      return res.status(403).json({
        error: 'User does not hold MySBT'
      })
    }

    // 2. 验证 ERC20 余额（可选）
    // const tokenBalance = await publicClient.readContract(...)
    // if (tokenBalance < estimatedCost) { ... }

    // 3. 签名 UserOpHash
    const validUntil = Math.floor(Date.now() / 1000) + 300 // 5分钟有效期
    const validAfter = Math.floor(Date.now() / 1000) - 60  // 1分钟前开始有效

    const signature = await signer.signMessage({
      message: { raw: userOpHash }
    })

    // 4. 构建 paymasterAndData
    // 格式: [paymaster (20)][validUntil (6)][validAfter (6)][signature (65)]
    const paymasterAndData = encodePaymasterAndData(
      PAYMASTER_ADDRESS,
      validUntil,
      validAfter,
      signature
    )

    res.json({
      paymasterAndData,
      validUntil,
      validAfter
    })

  } catch (error) {
    console.error('Paymaster signing error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

function encodePaymasterAndData(
  paymaster: string,
  validUntil: number,
  validAfter: number,
  signature: `0x${string}`
): `0x${string}` {
  // 编码逻辑
  const validUntilHex = validUntil.toString(16).padStart(12, '0')
  const validAfterHex = validAfter.toString(16).padStart(12, '0')

  return `${paymaster}${validUntilHex}${validAfterHex}${signature.slice(2)}` as `0x${string}`
}

app.listen(3001, () => {
  console.log('Paymaster service running on port 3001')
})
```

---

### Phase 3: 前端组件重构

#### **MetaMaskSmartAccount.tsx 新流程**

```typescript
// 简化的 UI 流程

export function MetaMaskSmartAccount() {
  const [step, setStep] = useState<'connect' | 'permissions' | 'transfer'>('connect')
  const { requestPermissions, batchTransfer } = useMetaMaskSmartAccount()

  const handleRequestPermissions = async () => {
    // 一键式权限请求
    // MetaMask 会自动处理：
    // 1. 检测 EOA → 弹出升级提示
    // 2. 用户确认 → EIP-7702 升级
    // 3. 显示权限规则 → 用户签署
    const permissions = await requestPermissions({
      delegate: sessionKeyAddress,
      requireMySBT: true,
      maxAmount: parseEther('1'),
      validityPeriod: 86400
    })

    setPermissions(permissions)
    setStep('transfer')
  }

  const handleBatchTransfer = async () => {
    // 使用 EIP-5792 批量交易
    const hash = await batchTransfer({
      recipients: [
        { address: '0x...', amount: parseEther('0.1') },
        { address: '0x...', amount: parseEther('0.2') }
      ],
      paymasterUrl: 'http://localhost:3001/api/sponsor'
    })

    console.log('Transaction:', hash)
  }

  return (
    <div>
      {step === 'connect' && (
        <button onClick={handleRequestPermissions}>
          开启 Gasless Delegation
        </button>
      )}

      {step === 'transfer' && (
        <BatchTransferForm onSubmit={handleBatchTransfer} />
      )}
    </div>
  )
}
```

---

## 🚀 实施路线图

### Week 1: 核心重构

- [ ] Day 1-2: 重构 `useMetaMaskSmartAccount.ts`
  - 删除手动升级逻辑
  - 实现 `requestPermissions`
  - 实现 `batchTransfer` (EIP-5792)

- [ ] Day 3-4: 部署 Paymaster 合约
  - 部署 `CustomERC20.sol`
  - 部署 `MySbtPaymaster.sol`
  - 配置白名单

- [ ] Day 5: 开发 Paymaster Service
  - 实现 SBT 验证
  - 实现签名逻辑
  - 部署后端服务

### Week 2: 集成测试

- [ ] Day 1-2: 前端组件重构
  - 简化 UI 流程
  - 集成 Paymaster

- [ ] Day 3-4: 端到端测试
  - 测试权限请求
  - 测试 Gasless 批量转账
  - 测试 Caveat Enforcers

- [ ] Day 5: 文档更新
  - 更新部署指南
  - 更新用户手册

---

## ✅ 验收标准

1. **功能完整性**
   - ✅ 用户连接 MetaMask 后，一键请求权限即可完成 EOA → Smart Account 升级
   - ✅ 支持 MySBT 验证的 Gasless 批量转账
   - ✅ 自定义 Paymaster 正常工作

2. **符合标准**
   - ✅ 使用 EIP-5792 `sendCalls` API
   - ✅ 使用 ERC-7715 `requestExecutionPermissions`
   - ✅ 不再手动调用 `signAuthorization`

3. **用户体验**
   - ✅ 整个流程不超过 3 步
   - ✅ Gas 费用由 Paymaster 承担（用户支付 ERC20）
   - ✅ 权限规则清晰展示

---

## 📚 参考资料

- [MetaMask Smart Accounts Kit](https://docs.metamask.io/smart-accounts-kit)
- [EIP-5792: Wallet Call API](https://eips.ethereum.org/EIPS/eip-5792)
- [ERC-7715: Advanced Permissions](https://ethereum-magicians.org/t/erc-7715-advanced-permissions/19616)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Viem EIP-7702 Docs](https://viem.sh/docs/eip7702/sending-transactions)

---

## 🎯 产品愿景

> **帮助每个 MetaMask 用户获得安全且简单的 delegation，提供定制化的 gasless 解决方案**

通过此次重构，我们将实现：

1. **简单**：一键式权限请求，无需理解复杂的技术细节
2. **安全**：利用 MetaMask 官方升级流程 + Custom Caveat Enforcers
3. **Gasless**：自定义 Paymaster，支持 MySBT + ERC20 支付
4. **可配置**：通过 Caveat Enforcers 实现日限额、批量限制等规则

---

**下一步**：开始实施 Phase 1 - Hook 层重构
