# MetaMask Framework 集成实施计划

## 项目目标
基于 MetaMask Delegation Framework 实现完整的 gasless 委托系统，支持批量转账和 MySBT 身份验证。

## 实施时间线：7 个工作日

## Day 1-2: 基础架构搭建

### 1. 环境准备
```bash
# 创建新的合约目录
mkdir contracts/metamask
cd contracts/metamask

# 引入必要的接口
cp ../interfaces/IMySBT.sol ./interfaces/
```

### 2. 创建 MySBT Enforcer
```solidity
// contracts/metamask/MySBTGatedEnforcer.sol
pragma solidity 0.8.23;

import {CaveatEnforcer} from "../../lib/delegation-framework/src/enforcers/CaveatEnforcer.sol";
import {ModeCode} from "../../lib/delegation-framework/src/utils/Types.sol";
import {IMySBT} from "./interfaces/IMySBT.sol";

contract MySBTGatedEnforcer is CaveatEnforcer {
    address public constant MY_SBT = 0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C;

    function beforeHook(
        bytes calldata _terms,
        bytes calldata,
        ModeCode _mode,
        bytes calldata,
        bytes32,
        address _delegator,
        address
    ) public view override {
        // 验证 delegator 持有 SBT
        require(
            IMySBT(MY_SBT).getUserSBT(_delegator) > 0,
            "MySBTGatedEnforcer: delegator must hold MySBT"
        );

        // 可选：验证最小持有时间等额外条件
        if (_terms.length > 0) {
            uint256 minTokenId = abi.decode(_terms, (uint256));
            require(
                IMySBT(MY_SBT).getUserSBT(_delegator) >= minTokenId,
                "MySBTGatedEnforcer: SBT token ID too low"
            );
        }
    }
}
```

### 3. 创建批量转账 Enforcer
```solidity
// contracts/metamask/GaslessBatchTransferEnforcer.sol
pragma solidity 0.8.23;

contract GaslessBatchTransferEnforcer is CaveatEnforcer {
    struct BatchTransferTerms {
        address[] allowedTokens;
        uint256 maxTotalAmount;
        uint256 maxRecipients;
    }

    // 实现批量转账限制逻辑
    function beforeHook(...) public override {
        // 验证批量转账参数
        // 检查接收者数量限制
        // 验证总金额限制
    }
}
```

## Day 3-4: 核心功能实现

### 1. 部署脚本
```solidity
// script/DeployMetaMaskIntegration.s.sol
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {MySBTGatedEnforcer} from "../contracts/metamask/MySBTGatedEnforcer.sol";

contract DeployMetaMaskIntegration is Script {
    // 使用已部署的 MetaMask 合约
    address constant DELEGATION_MANAGER = 0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3;
    address constant EIP7702_DELEGATOR = 0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B;

    function run() external {
        vm.startBroadcast();

        // 部署自定义 Enforcers
        MySBTGatedEnforcer sbtEnforcer = new MySBTGatedEnforcer();
        GaslessBatchTransferEnforcer batchEnforcer = new GaslessBatchTransferEnforcer();

        console.log("MySBTGatedEnforcer:", address(sbtEnforcer));
        console.log("GaslessBatchTransferEnforcer:", address(batchEnforcer));

        vm.stopBroadcast();
    }
}
```

### 2. 创建工具合约
```solidity
// contracts/metamask/DelegationHelper.sol
contract DelegationHelper {
    // 辅助创建委托
    function createGaslessDelegation(
        address delegator,
        address delegate,
        address[] calldata enforcers,
        bytes[] calldata terms
    ) external pure returns (Delegation memory) {
        // 构建委托结构
    }

    // 批量操作辅助
    function encodeBatchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external pure returns (bytes memory) {
        // 编码批量转账数据
    }
}
```

## Day 5: 前端集成

### 1. 创建 MetaMask Hook
```typescript
// src/hooks/useMetaMaskDelegation.ts
import { useState, useCallback } from 'react'
import {
  createWalletClient,
  encodeFunctionData,
  parseAbi
} from 'viem'
import { DelegationStruct, CaveatStruct } from '../types/delegation'

export const useMetaMaskDelegation = () => {
  const [delegation, setDelegation] = useState<DelegationStruct | null>(null)

  // 创建委托
  const createDelegation = useCallback(async (params: {
    delegator: `0x${string}`
    delegate: `0x${string}`
    requireSBT: boolean
    maxAmount?: bigint
  }) => {
    const caveats: CaveatStruct[] = []

    // 添加 SBT 验证
    if (params.requireSBT) {
      caveats.push({
        enforcer: MY_SBT_ENFORCER_ADDRESS,
        terms: '0x' // 空 terms 或编码的参数
      })
    }

    // 添加金额限制
    if (params.maxAmount) {
      caveats.push({
        enforcer: AMOUNT_ENFORCER_ADDRESS,
        terms: encodeAbiParameters(
          [{ type: 'uint256' }],
          [params.maxAmount]
        )
      })
    }

    // 签署委托
    const signedDelegation = await signDelegation({
      delegator: params.delegator,
      delegate: params.delegate,
      authority: ROOT_AUTHORITY,
      caveats
    })

    setDelegation(signedDelegation)
    return signedDelegation
  }, [])

  // 执行批量转账
  const executeBatchTransfer = useCallback(async (params: {
    recipients: `0x${string}`[]
    amounts: bigint[]
    tokenAddress?: `0x${string}`
  }) => {
    if (!delegation) throw new Error('No delegation')

    // 构建批量执行数据
    const executions = params.recipients.map((recipient, i) => ({
      target: params.tokenAddress || recipient,
      value: params.tokenAddress ? 0n : params.amounts[i],
      callData: params.tokenAddress
        ? encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, params.amounts[i]]
          })
        : '0x'
    }))

    // 通过 DelegationManager 执行
    return await redeemDelegations(
      [delegation],
      [BATCH_MODE],
      [encodeExecutions(executions)]
    )
  }, [delegation])

  return {
    delegation,
    createDelegation,
    executeBatchTransfer,
    // 其他功能...
  }
}
```

### 2. 更新 UI 组件
```typescript
// src/components/MetaMaskDelegation.tsx
import React from 'react'
import { useMetaMaskDelegation } from '../hooks/useMetaMaskDelegation'

export const MetaMaskDelegation: React.FC = () => {
  const { createDelegation, executeBatchTransfer } = useMetaMaskDelegation()

  const handleCreateDelegation = async () => {
    try {
      const delegation = await createDelegation({
        delegator: authorizerAddress,
        delegate: relayAddress,
        requireSBT: true,
        maxAmount: parseEther('100')
      })

      console.log('Delegation created:', delegation)
    } catch (error) {
      console.error('Failed to create delegation:', error)
    }
  }

  const handleBatchTransfer = async () => {
    try {
      const tx = await executeBatchTransfer({
        recipients: [addr1, addr2, addr3],
        amounts: [amount1, amount2, amount3]
      })

      console.log('Batch transfer executed:', tx)
    } catch (error) {
      console.error('Batch transfer failed:', error)
    }
  }

  return (
    <div className="delegation-panel">
      <h2>MetaMask Delegation Framework</h2>

      <div className="delegation-controls">
        <button onClick={handleCreateDelegation}>
          创建 Gasless 委托
        </button>

        <button onClick={handleBatchTransfer}>
          执行批量转账
        </button>
      </div>

      {/* 显示委托状态和详情 */}
    </div>
  )
}
```

## Day 6: 测试和优化

### 1. 单元测试
```solidity
// test/metamask/MySBTGatedEnforcer.t.sol
contract MySBTGatedEnforcerTest is Test {
    MySBTGatedEnforcer enforcer;

    function setUp() public {
        enforcer = new MySBTGatedEnforcer();
    }

    function testRequiresSBT() public {
        // 测试 SBT 验证逻辑
    }

    function testBatchTransferLimits() public {
        // 测试批量转账限制
    }
}
```

### 2. 集成测试
```typescript
// tests/metamask-integration.spec.ts
describe('MetaMask Delegation Integration', () => {
  it('should create delegation with SBT requirement', async () => {
    // 测试创建委托
  })

  it('should execute gasless batch transfer', async () => {
    // 测试批量转账
  })

  it('should enforce transfer limits', async () => {
    // 测试限制执行
  })
})
```

### 3. Gas 优化分析
```typescript
// scripts/gas-comparison.ts
async function compareGasCosts() {
  // 对比原实现 vs MetaMask Framework
  const results = {
    original: {
      singleTransfer: await measureGas(originalTransfer),
      batchTransfer: await measureGas(originalBatch)
    },
    metamask: {
      singleTransfer: await measureGas(metamaskTransfer),
      batchTransfer: await measureGas(metamaskBatch)
    }
  }

  console.table(results)
  // 预期：MetaMask 实现节省 30-50% Gas
}
```

## Day 7: 部署和文档

### 1. 部署清单
- [ ] 部署 MySBTGatedEnforcer
- [ ] 部署 GaslessBatchTransferEnforcer
- [ ] 部署 DelegationHelper
- [ ] 验证合约
- [ ] 更新前端配置

### 2. 文档更新
```markdown
# 使用指南

## 快速开始
1. 连接钱包
2. 创建委托（需要持有 MySBT）
3. 执行 gasless 操作

## API 文档
- createDelegation()
- executeBatchTransfer()
- revokeDelegation()

## 安全考虑
- Enforcer 执行顺序
- 委托撤销机制
- 紧急暂停功能
```

## 监控和维护

### 1. 事件监控
```typescript
// 监听委托创建
delegationManager.on('DelegationCreated', (hash, delegator, delegate) => {
  console.log('New delegation:', { hash, delegator, delegate })
})

// 监听委托执行
delegationManager.on('DelegationRedeemed', (hash, redeemer, result) => {
  console.log('Delegation executed:', { hash, redeemer, result })
})
```

### 2. 健康检查
```typescript
// 定期检查系统状态
async function healthCheck() {
  const checks = {
    delegationManager: await checkContract(DELEGATION_MANAGER),
    sbtEnforcer: await checkContract(SBT_ENFORCER),
    gasBalance: await checkRelayBalance(),
    pendingDelegations: await countPendingDelegations()
  }

  return checks
}
```

## 风险管理

### 1. 回滚计划
- 保留原实现 30 天
- 双轨运行期间逐步迁移
- 紧急切换机制

### 2. 安全审计
- 内部代码审查
- Slither 静态分析
- Echidna 模糊测试

## 成功指标

### 技术指标
- ✅ Gas 成本降低 30%+
- ✅ 交易成功率 > 99%
- ✅ 响应时间 < 2s

### 业务指标
- ✅ 支持 100+ 并发用户
- ✅ 日处理 1000+ 交易
- ✅ 零安全事故

## 关键里程碑

| 时间 | 里程碑 | 交付物 |
|------|--------|--------|
| Day 2 | 基础架构完成 | Enforcers 部署 |
| Day 4 | 核心功能完成 | 批量转账可用 |
| Day 5 | 前端集成完成 | UI 更新上线 |
| Day 6 | 测试完成 | 测试报告 |
| Day 7 | 正式上线 | Sepolia 部署 |

## 团队分工

- **智能合约**: Enforcer 开发、测试
- **前端**: Hook 集成、UI 更新
- **测试**: E2E 测试、Gas 分析
- **运维**: 部署、监控配置

## 后续优化

### Phase 2 (第二周)
- 添加更多 Enforcer 类型
- 实现委托市场功能
- 集成 Account Abstraction

### Phase 3 (第三周)
- 多链部署
- SDK 封装
- 开发者文档

## 总结

通过采用 MetaMask Delegation Framework，我们可以：
1. **快速实现** gasless 功能（7 天 vs 原计划 2-3 周）
2. **显著降低** Gas 成本（预计节省 30-50%）
3. **提供更好的** 用户体验（批量操作、灵活权限）
4. **确保安全性**（经过审计的代码）

建议立即启动实施，充分利用 MetaMask 的成熟框架加速产品上线。