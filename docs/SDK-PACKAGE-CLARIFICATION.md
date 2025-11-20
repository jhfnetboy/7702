# SDK 包说明和技术路径

## 📦 关键发现："Smart Accounts Kit" 不是一个 npm 包

### 重要澄清

**误解**：需要安装 `@metamask/smart-accounts-kit` 包

**真相**：
1. **"Smart Accounts Kit"** 是 MetaMask 的**产品名称**和**文档名称**
2. 实际的 npm 包是 **`@metamask/delegation-toolkit`**（我们已经安装了 v0.13.0）
3. 所有文档中提到的功能都在这个包里

---

## ✅ 已安装的包（无需额外安装）

### 1. `@metamask/delegation-toolkit` v0.13.0

**已有的导出**：

```typescript
// 从 node_modules/@metamask/delegation-toolkit/dist/experimental/index.d.ts

// ✅ ERC-7715 Provider Actions (请求权限)
export const erc7715ProviderActions: () => (client: Client) => {
  requestExecutionPermissions: (
    parameters: RequestExecutionPermissionsParameters
  ) => Promise<RequestExecutionPermissionsReturnType>
}

// ✅ ERC-7710 Wallet Actions (发送带委托的交易)
export const erc7710WalletActions: () => (client: WalletClient) => {
  sendTransactionWithDelegation: (
    args: SendTransactionWithDelegationParameters
  ) => Promise<`0x${string}`>
}

// ✅ ERC-7710 Bundler Actions (发送 UserOperation)
export const erc7710BundlerActions: () => (client: Client) => {
  sendUserOperationWithDelegation: (
    args: SendUserOperationWithDelegationParameters
  ) => Promise<`0x${string}`>
}

// ✅ Delegation Storage (存储委托)
export class DelegationStorageClient {
  getDelegationChain(leafDelegationOrDelegationHash: Hex | Delegation): Promise<Delegation[]>
  fetchDelegations(deleGatorAddress: Hex, filterMode?: DelegationStoreFilter): Promise<Delegation[]>
  storeDelegation(delegation: Delegation): Promise<Hex>
}
```

### 2. `viem` v2.39.3

**已有的 EIP-5792 支持**：

```typescript
// 从 viem/experimental

// ✅ EIP-5792 Actions (批量交易和 Gasless)
export function eip5792Actions() {
  return (client: Client) => ({
    // 获取钱包能力（是否支持 Paymaster、批量交易等）
    getCapabilities: (params?) => Promise<GetCapabilitiesReturnType>

    // 发送批量调用
    sendCalls: (params: {
      calls: Array<{ to: Address; value?: bigint; data?: Hex }>
      capabilities?: {
        paymasterService?: { url: string }
      }
    }) => Promise<SendCallsReturnType>

    // 获取调用状态
    getCallsStatus: (params: { id: string }) => Promise<GetCallsStatusReturnType>

    // 等待调用完成
    waitForCallsStatus: (params: { id: string }) => Promise<WaitForCallsStatusReturnType>

    // 批量合约写入
    writeContracts: (params) => Promise<WriteContractsReturnType>
  })
}
```

**注意**：虽然 viem 将 `eip5792Actions` 标记为 deprecated（建议使用 viem v3 的 `walletActions`），但在 viem 2.39.3 中仍然**完全可用**。

---

## 🎯 正确的技术路径

### 文档中的代码示例解析

#### 示例 1: 创建 WalletClient

```typescript
// 文档中的代码
import { createWalletClient, custom } from 'viem'
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental'
import { erc5792Actions } from 'viem/experimental'

const walletClient = createWalletClient({
  transport: custom(window.ethereum)
})
  .extend(erc7715ProviderActions())  // ✅ 来自 delegation-toolkit
  .extend(erc5792Actions())          // ✅ 来自 viem
```

**解释**：
- `erc7715ProviderActions` 来自 `@metamask/delegation-toolkit/experimental`
- `erc5792Actions` 来自 `viem/experimental`
- 两者都**已经存在**于我们已安装的包中

#### 示例 2: 请求权限（ERC-7715）

```typescript
// 文档中的代码
const permissions = await walletClient.requestExecutionPermissions([{
  chainId: '0x1',
  expiry: Date.now() / 1000 + 86400,
  signer: {
    type: "account",
    data: { address: sessionKeyAddress }
  },
  permission: {
    type: "erc20-token-periodic",
    data: {
      tokenAddress: '0xUSDC...',
      periodAmount: parseUnits("100", 6),
      periodDuration: 86400
    }
  }
}])
```

**实际可用的权限类型**（从 delegation-toolkit 类型定义）：
```typescript
type SupportedPermissionParams =
  | NativeTokenStreamPermissionParameter      // 原生代币流式支付
  | Erc20TokenStreamPermissionParameter       // ERC20 流式支付
  | NativeTokenPeriodicPermissionParameter    // 原生代币周期性限额
  | Erc20TokenPeriodicPermissionParameter     // ERC20 周期性限额
```

#### 示例 3: 批量交易（EIP-5792）

```typescript
// 文档中的代码
const id = await walletClient.sendCalls({
  calls: [
    { to: '0x...', value: 0n, data: '0x...' },
    { to: '0x...', value: 0n, data: '0x...' }
  ],
  capabilities: {
    paymasterService: {
      url: 'https://your-paymaster-url...'
    }
  }
})
```

**这个方法来自**：`viem/experimental` 的 `eip5792Actions`

---

## 🛠️ 实现计划详解

### Phase 1: 重构 Hook (useMetaMaskSmartAccount.ts)

#### 1.1 导入正确的包

```typescript
// src/hooks/useMetaMaskSmartAccount.ts

import { createWalletClient, custom, type Address, type Hash } from 'viem'
import { sepolia } from 'viem/chains'

// ✅ EIP-5792: 批量交易
import { eip5792Actions } from 'viem/experimental'

// ✅ ERC-7715: 权限请求
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental'
import type {
  RequestExecutionPermissionsParameters,
  RequestExecutionPermissionsReturnType
} from '@metamask/delegation-toolkit/experimental'

// ✅ 合约配置
import { CONTRACTS } from '../config/shared-config-adapter'
```

#### 1.2 创建扩展的 WalletClient

```typescript
export function useMetaMaskSmartAccount() {
  const [state, setState] = useState({
    permissions: null as RequestExecutionPermissionsReturnType | null,
    isLoading: false,
    error: null as string | null
  })

  // 创建扩展的 WalletClient
  const createExtendedClient = useCallback(() => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    return createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum)
    })
      .extend(erc5792Actions())       // 批量交易能力
      .extend(erc7715ProviderActions()) // 权限请求能力
  }, [])
```

#### 1.3 检查钱包能力

```typescript
  /**
   * 检查 MetaMask 是否支持 EIP-5792 和 Smart Accounts
   */
  const checkCapabilities = useCallback(async () => {
    const client = createExtendedClient()

    try {
      const capabilities = await client.getCapabilities()

      return {
        supportsAtomicBatch: !!capabilities[sepolia.id]?.atomicBatch,
        supportsPaymaster: !!capabilities[sepolia.id]?.paymasterService,
        allCapabilities: capabilities
      }
    } catch (error) {
      console.error('Failed to get capabilities:', error)
      return {
        supportsAtomicBatch: false,
        supportsPaymaster: false,
        allCapabilities: {}
      }
    }
  }, [createExtendedClient])
```

#### 1.4 请求执行权限（替代手动创建 Delegation）

```typescript
  /**
   * 请求执行权限（ERC-7715）
   * 这会触发 MetaMask 自动升级 EOA → Smart Account
   */
  const requestPermissions = useCallback(async (params: {
    sessionKey: Address       // Dapp 的 Session Key
    requireMySBT?: boolean    // 是否需要 MySBT 验证
    maxAmount?: bigint        // 最大金额限制
    periodDuration?: number   // 周期（秒）
    tokenAddress?: Address    // ERC20 地址（可选）
  }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const client = createExtendedClient()

      // 构建权限请求
      const permissionRequests: RequestExecutionPermissionsParameters = []

      // 添加金额限制权限
      if (params.maxAmount) {
        if (params.tokenAddress) {
          // ERC20 周期性限额
          permissionRequests.push({
            chainId: sepolia.id,
            expiry: Math.floor(Date.now() / 1000) + (params.periodDuration || 86400),
            signer: {
              type: 'account',
              data: { address: params.sessionKey }
            },
            permission: {
              type: 'erc20-token-periodic',
              data: {
                tokenAddress: params.tokenAddress,
                periodAmount: params.maxAmount,
                periodDuration: params.periodDuration || 86400
              }
            },
            isAdjustmentAllowed: false
          })
        } else {
          // 原生代币周期性限额
          permissionRequests.push({
            chainId: sepolia.id,
            expiry: Math.floor(Date.now() / 1000) + (params.periodDuration || 86400),
            signer: {
              type: 'account',
              data: { address: params.sessionKey }
            },
            permission: {
              type: 'native-token-periodic',
              data: {
                periodAmount: params.maxAmount,
                periodDuration: params.periodDuration || 86400
              }
            },
            isAdjustmentAllowed: false
          })
        }
      }

      // 请求权限
      // MetaMask 会自动：
      // 1. 检测用户是 EOA
      // 2. 弹出"切换到 Smart Account"提示
      // 3. 用户确认后自动完成 EIP-7702 升级
      // 4. 显示权限规则
      // 5. 用户签署委托
      const permissions = await client.requestExecutionPermissions(permissionRequests)

      console.log('✅ Permissions granted:', permissions)

      setState(prev => ({
        ...prev,
        permissions,
        isLoading: false
      }))

      return permissions
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to request permissions'
      console.error('❌ Permission request failed:', error)
      setState(prev => ({
        ...prev,
        error: errorMsg,
        isLoading: false
      }))
      throw error
    }
  }, [createExtendedClient])
```

#### 1.5 执行批量转账（EIP-5792）

```typescript
  /**
   * 执行批量转账（Gasless）
   * 使用 EIP-5792 sendCalls
   */
  const batchTransfer = useCallback(async (params: {
    recipients: Array<{
      address: Address
      amount: bigint
      token?: Address
    }>
    paymasterUrl?: string  // 自定义 Paymaster 服务 URL
  }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const client = createExtendedClient()

      // 构建批量调用
      const calls = params.recipients.map(recipient => {
        if (recipient.token) {
          // ERC20 转账
          return {
            to: recipient.token,
            value: 0n,
            data: encodeFunctionData({
              abi: [{
                name: 'transfer',
                type: 'function',
                inputs: [
                  { name: 'to', type: 'address' },
                  { name: 'amount', type: 'uint256' }
                ],
                outputs: [{ type: 'bool' }]
              }],
              functionName: 'transfer',
              args: [recipient.address, recipient.amount]
            }) as Hash
          }
        } else {
          // ETH 转账
          return {
            to: recipient.address,
            value: recipient.amount,
            data: '0x' as Hash
          }
        }
      })

      // 使用 EIP-5792 sendCalls
      // MetaMask 会自动封装成 UserOperation
      const callId = await client.sendCalls({
        calls,
        ...(params.paymasterUrl && {
          capabilities: {
            paymasterService: {
              url: params.paymasterUrl
            }
          }
        })
      })

      console.log('✅ Batch transfer submitted:', callId)

      // 等待交易完成
      const result = await client.waitForCallsStatus({ id: callId })

      console.log('✅ Batch transfer completed:', result)

      setState(prev => ({ ...prev, isLoading: false }))
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to execute batch transfer'
      console.error('❌ Batch transfer failed:', error)
      setState(prev => ({
        ...prev,
        error: errorMsg,
        isLoading: false
      }))
      throw error
    }
  }, [createExtendedClient])

  return {
    ...state,
    checkCapabilities,
    requestPermissions,
    batchTransfer,
    contracts: CONTRACTS
  }
}
```

---

### Phase 2: Custom Caveat Enforcers

**关键理解**：我们的 Caveat Enforcers (`MySBTGatedEnforcer`, `BatchTransferEnforcer`) **不需要修改**。

文档明确指出：

> 你不需要替换用户的账户合约。你只需要写一个轻量级的**规则合约（Caveat Enforcer）**。

我们已经有了：
- ✅ `MySBTGatedEnforcer.sol` - 验证用户持有 MySBT
- ✅ `BatchTransferEnforcer.sol` - 限制批量转账规则

这些是**正确的实现方式**！

**但是**，目前 `@metamask/delegation-toolkit` 的 `requestExecutionPermissions` 只支持内置的权限类型：
- `native-token-stream`
- `erc20-token-stream`
- `native-token-periodic`
- `erc20-token-periodic`

**自定义 Caveat Enforcer 的集成**需要使用更底层的 API（来自 `@metamask/delegation-toolkit` 的主导出，而不是 experimental）。

---

### Phase 3: 自定义 Paymaster

这部分在 `REFACTOR-PLAN.md` 中已经详细说明：

1. **CustomERC20.sol** - 支持 Paymaster 白名单扣款
2. **MySbtPaymaster.sol** - 验证签名 + 扣 ERC20
3. **Paymaster Service** - Node.js 后端（检查 SBT + 签名）

---

## 🎯 总结

### 不需要安装的包

❌ `@metamask/smart-accounts-kit` - 这不是一个包，只是产品名称

### 已有的包（无需额外安装）

✅ `@metamask/delegation-toolkit` v0.13.0
  - `erc7715ProviderActions` ✅
  - `erc7710WalletActions` ✅
  - `erc7710BundlerActions` ✅

✅ `viem` v2.39.3
  - `eip5792Actions` ✅
  - `sendCalls`, `getCapabilities` 等 ✅

### 技术路径确认

1. **不手动调用 `signAuthorization`** ✅
2. **使用 `requestExecutionPermissions` (ERC-7715)** ✅
3. **使用 `sendCalls` (EIP-5792)** ✅
4. **保留 Custom Caveat Enforcers** ✅
5. **自定义 Paymaster** ✅

---

## 📋 下一步行动

1. ✅ 验证包已安装 - **完成**
2. 🔄 实施 Phase 1: 重构 `useMetaMaskSmartAccount.ts`
3. 🔄 实施 Phase 2: 部署并集成 Paymaster
4. 🔄 实施 Phase 3: 重构前端组件

---

**关键点**：我们拥有所有需要的工具，无需安装新包。现在可以开始重构！
