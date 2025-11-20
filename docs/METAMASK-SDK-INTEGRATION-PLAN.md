# MetaMask Delegation Toolkit 集成计划 (2025.11)

## 执行摘要

基于当前情况（2025年11月，Pectra 已上线，EIP-7702 已激活），我们必须完全采用 MetaMask Delegation Toolkit 来获得标准接口支持。

## 一、关键技术要求

### 1.1 必须使用的技术栈
- **SDK**: `@metamask/delegation-toolkit` (必须)
- **合约地址**: 从 `@aastar/shared-config` 获取 (禁止硬编码)
- **协议**: EIP-7702 (已在主网激活)

### 1.2 安装依赖
```bash
# 安装 MetaMask Delegation Toolkit
pnpm add @metamask/delegation-toolkit

# 确保 shared-config 是最新版本
pnpm update @aastar/shared-config
```

## 二、架构设计

### 2.1 合约地址管理

```typescript
// src/config/contracts.ts
import { getContractAddress, getContractABI } from '@aastar/shared-config'

// 禁止硬编码，必须从 shared-config 获取
export const CONTRACT_ADDRESSES = {
  // MetaMask 官方合约
  delegationManager: getContractAddress('DelegationManager', 'sepolia'),
  eip7702Delegator: getContractAddress('EIP7702StatelessDeleGator', 'sepolia'),

  // MySBT 合约
  mySBT: getContractAddress('MySBT', 'sepolia'),

  // 自定义 Enforcers (需要部署后更新到 shared-config)
  mySBTEnforcer: getContractAddress('MySBTGatedEnforcer', 'sepolia'),
  batchTransferEnforcer: getContractAddress('BatchTransferEnforcer', 'sepolia'),
}

// ABI 也从 shared-config 获取
export const CONTRACT_ABIS = {
  delegationManager: getContractABI('DelegationManager'),
  eip7702Delegator: getContractABI('EIP7702StatelessDeleGator'),
  mySBT: getContractABI('MySBT'),
}
```

### 2.2 Smart Account 集成

```typescript
// src/hooks/useMetaMaskSmartAccount.ts
import {
  createPublicClient,
  createWalletClient,
  createBundlerClient,
  http
} from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import {
  Implementation,
  toMetaMaskSmartAccount,
  createDelegationClient,
  signDelegation,
} from "@metamask/delegation-toolkit"
import { CONTRACT_ADDRESSES } from '../config/contracts'

export function useMetaMaskSmartAccount() {
  // 1. 创建客户端
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  })

  const bundlerClient = createBundlerClient({
    chain: sepolia,
    transport: http("https://bundler.sepolia.metamask.io"),
  })

  // 2. 创建 Smart Account (使用 EIP-7702)
  const createSmartAccount = async (privateKey: `0x${string}`) => {
    const account = privateKeyToAccount(privateKey)

    // 使用 MetaMask 的 Stateless7702 实现
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      deployParams: [account.address],
      deploySalt: "0x",
      signatory: { account },
      // 使用 shared-config 的地址
      factoryAddress: CONTRACT_ADDRESSES.eip7702Delegator,
    })

    return smartAccount
  }

  // 3. 创建委托
  const createDelegation = async (params: {
    delegator: `0x${string}`
    delegate: `0x${string}`
    caveats: Array<{
      enforcer: `0x${string}`
      terms: `0x${string}`
    }>
  }) => {
    const delegationClient = createDelegationClient({
      transport: http(),
      chain: sepolia,
      delegationManagerAddress: CONTRACT_ADDRESSES.delegationManager,
    })

    // 签署委托
    const signedDelegation = await signDelegation({
      delegation: {
        delegate: params.delegate,
        delegator: params.delegator,
        authority: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // ROOT_AUTHORITY
        caveats: params.caveats,
      },
      signatory: { account: privateKeyToAccount(params.delegator) },
    })

    return signedDelegation
  }

  // 4. 执行 gasless 操作
  const executeGaslessOperation = async (
    smartAccount: any,
    operation: any
  ) => {
    // 通过 bundler 发送用户操作
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: operation.calls,
      paymaster: CONTRACT_ADDRESSES.paymaster, // 从 shared-config 获取
      paymasterData: "0x",
    })

    return userOpHash
  }

  return {
    createSmartAccount,
    createDelegation,
    executeGaslessOperation,
  }
}
```

## 三、MySBT 集成方案

### 3.1 创建 MySBT Caveat Enforcer

```solidity
// contracts/enforcers/MySBTGatedEnforcer.sol
pragma solidity 0.8.23;

import {CaveatEnforcer} from "@metamask/delegation-framework/src/enforcers/CaveatEnforcer.sol";
import {ModeCode} from "@metamask/delegation-framework/src/utils/Types.sol";

interface IMySBT {
    function getUserSBT(address u) external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
}

contract MySBTGatedEnforcer is CaveatEnforcer {
    // 使用 shared-config 中的地址（部署时注入）
    address public immutable MY_SBT;

    constructor(address _mySBT) {
        MY_SBT = _mySBT;
    }

    function beforeHook(
        bytes calldata _terms,
        bytes calldata,
        ModeCode _mode,
        bytes calldata,
        bytes32,
        address _delegator,
        address
    ) public view override {
        require(
            IMySBT(MY_SBT).getUserSBT(_delegator) > 0,
            "MySBTGatedEnforcer: Must hold MySBT"
        );

        // 可选：解析 terms 添加额外条件
        if (_terms.length > 0) {
            uint256 minSBTId = abi.decode(_terms, (uint256));
            require(
                IMySBT(MY_SBT).getUserSBT(_delegator) >= minSBTId,
                "MySBTGatedEnforcer: SBT ID too low"
            );
        }
    }
}
```

### 3.2 部署脚本

```typescript
// scripts/deploy-enforcers.ts
import { deployContract } from '@metamask/delegation-toolkit/deploy'
import { getContractAddress } from '@aastar/shared-config'

async function deployEnforcers() {
  const mySBTAddress = getContractAddress('MySBT', 'sepolia')

  // 部署 MySBT Enforcer
  const mySBTEnforcer = await deployContract({
    contractName: 'MySBTGatedEnforcer',
    constructorArgs: [mySBTAddress],
    network: 'sepolia',
  })

  // 更新到 shared-config
  await updateSharedConfig({
    contractName: 'MySBTGatedEnforcer',
    address: mySBTEnforcer.address,
    network: 'sepolia',
  })

  console.log('MySBTGatedEnforcer deployed:', mySBTEnforcer.address)
}
```

## 四、批量转账实现

### 4.1 使用 MetaMask SDK 的批量操作

```typescript
// src/hooks/useBatchTransfer.ts
import {
  createBatchTransferDelegation,
  BatchTransferCaveat,
} from '@metamask/delegation-toolkit'
import { CONTRACT_ADDRESSES } from '../config/contracts'

export function useBatchTransfer() {
  const executeBatchTransfer = async (params: {
    smartAccount: any
    recipients: Array<{
      address: `0x${string}`
      amount: bigint
      token?: `0x${string}` // 可选：ERC20 代币地址
    }>
  }) => {
    const { smartAccount, recipients } = params

    // 创建批量转账 caveat
    const batchCaveat = new BatchTransferCaveat({
      enforcer: CONTRACT_ADDRESSES.batchTransferEnforcer,
      terms: {
        recipients: recipients.map(r => r.address),
        amounts: recipients.map(r => r.amount),
        tokens: recipients.map(r => r.token || '0x0'), // ETH 为 0x0
      }
    })

    // 创建带 caveat 的委托
    const delegation = await createBatchTransferDelegation({
      delegator: smartAccount.address,
      delegate: CONTRACT_ADDRESSES.relayService,
      caveats: [
        // MySBT 验证
        {
          enforcer: CONTRACT_ADDRESSES.mySBTEnforcer,
          terms: '0x',
        },
        // 批量转账限制
        batchCaveat,
      ],
    })

    // 执行批量转账
    const calls = recipients.map(r => ({
      to: r.token || r.address, // 代币合约或接收者地址
      value: r.token ? 0n : r.amount, // ERC20 时 value 为 0
      data: r.token
        ? encodeERC20Transfer(r.address, r.amount)
        : '0x',
    }))

    return await smartAccount.execute(calls, delegation)
  }

  return { executeBatchTransfer }
}
```

## 五、前端集成

### 5.1 更新 App 组件

```typescript
// src/components/MetaMaskDelegation.tsx
import React, { useState } from 'react'
import { useMetaMaskSmartAccount } from '../hooks/useMetaMaskSmartAccount'
import { useBatchTransfer } from '../hooks/useBatchTransfer'
import { CONTRACT_ADDRESSES } from '../config/contracts'

export function MetaMaskDelegation() {
  const { createSmartAccount, createDelegation } = useMetaMaskSmartAccount()
  const { executeBatchTransfer } = useBatchTransfer()
  const [smartAccount, setSmartAccount] = useState(null)

  // 步骤 1：创建 Smart Account
  const handleCreateAccount = async () => {
    const privateKey = getPrivateKeyFromUser() // 安全获取
    const account = await createSmartAccount(privateKey)
    setSmartAccount(account)
  }

  // 步骤 2：创建委托
  const handleCreateDelegation = async () => {
    if (!smartAccount) return

    const delegation = await createDelegation({
      delegator: smartAccount.address,
      delegate: CONTRACT_ADDRESSES.relayService,
      caveats: [
        {
          enforcer: CONTRACT_ADDRESSES.mySBTEnforcer,
          terms: '0x',
        },
      ],
    })

    console.log('Delegation created:', delegation)
  }

  // 步骤 3：执行批量转账
  const handleBatchTransfer = async () => {
    if (!smartAccount) return

    const result = await executeBatchTransfer({
      smartAccount,
      recipients: [
        { address: '0x...', amount: parseEther('0.1') },
        { address: '0x...', amount: parseEther('0.2') },
        { address: '0x...', amount: parseEther('0.3') },
      ],
    })

    console.log('Batch transfer completed:', result)
  }

  return (
    <div className="metamask-delegation">
      <h2>MetaMask Smart Account (EIP-7702)</h2>

      <div className="steps">
        <button onClick={handleCreateAccount}>
          1. 创建 Smart Account
        </button>

        <button onClick={handleCreateDelegation} disabled={!smartAccount}>
          2. 创建 MySBT 验证委托
        </button>

        <button onClick={handleBatchTransfer} disabled={!smartAccount}>
          3. 执行 Gasless 批量转账
        </button>
      </div>

      {smartAccount && (
        <div className="account-info">
          <p>Smart Account: {smartAccount.address}</p>
          <p>Implementation: Stateless7702</p>
        </div>
      )}
    </div>
  )
}
```

### 5.2 更新配置文件

```typescript
// src/config/shared-config-adapter.ts
import {
  getContractAddress as getAddress,
  getContractABI as getABI,
  NetworkName,
} from '@aastar/shared-config'

// 适配器函数，确保类型安全
export function getContractAddress(
  name: string,
  network: NetworkName = 'sepolia'
): `0x${string}` {
  const address = getAddress(name, network)
  if (!address) {
    throw new Error(`Contract ${name} not found in shared-config`)
  }
  return address as `0x${string}`
}

export function getContractABI(name: string) {
  const abi = getABI(name)
  if (!abi) {
    throw new Error(`ABI for ${name} not found in shared-config`)
  }
  return abi
}

// 导出所有需要的地址
export const CONTRACTS = {
  // MetaMask 官方
  delegationManager: getContractAddress('DelegationManager'),
  eip7702Delegator: getContractAddress('EIP7702StatelessDeleGator'),

  // AAStar
  mySBT: getContractAddress('MySBT'),

  // 自定义（部署后添加）
  mySBTEnforcer: getContractAddress('MySBTGatedEnforcer'),
  batchTransferEnforcer: getContractAddress('BatchTransferEnforcer'),

  // 服务
  relayService: getContractAddress('RelayService'),
  paymaster: getContractAddress('Paymaster'),
} as const
```

## 六、测试计划

### 6.1 单元测试

```typescript
// tests/metamask-integration.test.ts
import { describe, it, expect } from 'vitest'
import { useMetaMaskSmartAccount } from '../src/hooks/useMetaMaskSmartAccount'

describe('MetaMask Smart Account Integration', () => {
  it('should create smart account with EIP-7702', async () => {
    const { createSmartAccount } = useMetaMaskSmartAccount()
    const account = await createSmartAccount(TEST_PRIVATE_KEY)

    expect(account).toBeDefined()
    expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(account.implementation).toBe('Stateless7702')
  })

  it('should create delegation with MySBT caveat', async () => {
    // 测试委托创建
  })

  it('should execute gasless batch transfer', async () => {
    // 测试批量转账
  })
})
```

### 6.2 集成测试

```bash
# 运行集成测试
pnpm test:integration

# 测试覆盖率
pnpm test:coverage
```

## 七、部署清单

### 7.1 合约部署顺序

1. [ ] 部署 MySBTGatedEnforcer
2. [ ] 部署 BatchTransferEnforcer
3. [ ] 更新 shared-config 包
4. [ ] 部署 RelayService
5. [ ] 部署 Paymaster

### 7.2 前端部署

1. [ ] 安装 @metamask/delegation-toolkit
2. [ ] 更新所有硬编码地址为 shared-config
3. [ ] 集成 Smart Account hooks
4. [ ] 测试完整流程
5. [ ] 部署到生产环境

## 八、时间线

### Week 1 (本周)
- Day 1-2: 安装 SDK，配置 shared-config
- Day 3-4: 部署 Enforcers，集成 Smart Account
- Day 5: 前端集成，基础测试

### Week 2
- Day 1-2: 批量操作实现
- Day 3-4: 完整测试
- Day 5: 部署到 Sepolia

## 九、监控和维护

### 9.1 事件监听

```typescript
// 监听委托事件
delegationClient.on('DelegationCreated', (event) => {
  console.log('New delegation:', event)
})

// 监听批量转账事件
smartAccount.on('BatchTransferExecuted', (event) => {
  console.log('Batch transfer:', event)
})
```

### 9.2 健康检查

```typescript
async function healthCheck() {
  return {
    sdkVersion: await getSDKVersion(),
    contractsDeployed: await checkContracts(CONTRACTS),
    mySBTStatus: await checkMySBTContract(),
    gasBalance: await checkRelayGasBalance(),
  }
}
```

## 十、关键注意事项

### ⚠️ 必须遵守的规则

1. **禁止硬编码地址** - 所有地址必须从 `@aastar/shared-config` 获取
2. **必须使用 MetaMask SDK** - 不是借鉴，是完全使用
3. **遵循 MetaMask 标准** - 使用官方的接口和方法
4. **EIP-7702 已激活** - Pectra 升级已完成，可直接使用

### ✅ 优势

1. **官方支持** - MetaMask 提供完整的接口支持
2. **生产就绪** - 2025年11月，SDK 已成熟
3. **标准兼容** - 完全符合 EIP-7702 标准
4. **功能完整** - 批量操作、Gas 赞助、委托管理

## 总结

通过完全采用 MetaMask Delegation Toolkit，我们可以：
1. 获得 MetaMask 的完整接口支持
2. 实现标准的 EIP-7702 功能
3. 集成 MySBT 身份验证
4. 提供完整的 gasless 批量转账功能

预计 **2 周内完成全部集成**。