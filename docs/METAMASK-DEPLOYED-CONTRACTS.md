# MetaMask Delegation Framework - 已部署合约地址

## Sepolia 测试网合约地址

### 核心合约
| 合约 | 地址 | 说明 |
|------|------|------|
| **DelegationManager** | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` | 委托管理器 |
| **EIP7702StatelessDeleGator** | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` | EIP-7702 无状态实现 |
| **MultiSigDeleGator** | `0x56a9EdB16a0105eb5a4C54f4C062e2868844f3A7` | 多签实现 |
| **HybridDeleGator** | `0x48dBe696A4D990079e039489bA2053B36E8FFEC4` | 混合实现 |

### 关键 Enforcers (权限控制器)

#### 代币转账类
| Enforcer | 地址 | 功能 |
|----------|------|------|
| **ERC20TransferAmountEnforcer** | `0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc` | ERC20 转账金额限制 |
| **NativeTokenTransferAmountEnforcer** | `0xF71af580b9c3078fbc2BBF16FbB8EEd82b330320` | ETH 转账金额限制 |
| **SpecificActionERC20TransferBatchEnforcer** | `0x6649b61c873F6F9686A1E1ae9ee98aC380c7bA13` | ERC20 批量转账 |
| **ERC20BalanceChangeEnforcer** | `0xcdF6aB796408598Cea671d79506d7D48E97a5437` | ERC20 余额变化验证 |
| **NativeBalanceChangeEnforcer** | `0xbD7B277507723490Cd50b12EaaFe87C616be6880` | ETH 余额变化验证 |

#### 访问控制类
| Enforcer | 地址 | 功能 |
|----------|------|------|
| **AllowedTargetsEnforcer** | `0x7F20f61b1f09b08D970938F6fa563634d65c4EeB` | 限制调用目标 |
| **AllowedMethodsEnforcer** | `0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5` | 限制调用方法 |
| **AllowedCalldataEnforcer** | `0xc2b0d624c1c4319760C96503BA27C347F3260f55` | 限制调用数据 |

#### 时间/次数限制类
| Enforcer | 地址 | 功能 |
|----------|------|------|
| **TimestampEnforcer** | `0x1046bb45C8d673d4ea75321280DB34899413c069` | 时间戳限制 |
| **BlockNumberEnforcer** | `0x5d9818dF0AE3f66e9c3D0c5029DAF99d1823ca6c` | 区块高度限制 |
| **LimitedCallsEnforcer** | `0x04658B29F6b82ed55274221a06Fc97D318E25416` | 调用次数限制 |
| **NonceEnforcer** | `0xDE4f2FAC4B3D87A1d9953Ca5FC09FCa7F366254f` | Nonce 验证 |

#### 批量操作类
| Enforcer | 地址 | 功能 |
|----------|------|------|
| **ERC20MultiOperationIncreaseBalanceEnforcer** | `0xeaA1bE91F0ea417820a765df9C5BE542286BFfDC` | ERC20 批量增加余额 |
| **NativeTokenMultiOperationIncreaseBalanceEnforcer** | `0xaD551E9b971C1b0c02c577bFfCFAA20b81777276` | ETH 批量增加余额 |

### 辅助合约
| 合约 | 地址 | 说明 |
|------|------|------|
| **SimpleFactory** | `0x69Aa2f9fe1572F1B640E1bbc512f5c3a734fc77c` | 合约工厂 |

## 快速集成示例

### 1. 创建委托
```javascript
// 使用已部署的 DelegationManager
const DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3'

// 添加权限控制
const caveats = [
  {
    enforcer: '0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc', // ERC20 限额
    terms: encodeAmount(parseEther('100'))
  },
  {
    enforcer: '0x1046bb45C8d673d4ea75321280DB34899413c069', // 时间限制
    terms: encodeTimestamp(Date.now() + 86400000) // 24小时
  }
]
```

### 2. 批量转账配置
```javascript
// 使用批量转账 Enforcer
const BATCH_ENFORCER = '0x6649b61c873F6F9686A1E1ae9ee98aC380c7bA13'

const batchTransferTerms = {
  tokenAddress: USDC_ADDRESS,
  recipients: [addr1, addr2, addr3],
  amounts: [amount1, amount2, amount3]
}
```

### 3. Gas 优化配置
```javascript
// 使用 EIP7702 无状态实现
const EIP7702_DELEGATOR = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B'

// 无需初始化，直接授权
const authorization = await walletClient.signAuthorization({
  account: eoa,
  contractAddress: EIP7702_DELEGATOR
})
```

## 网络配置

### RPC 端点
```javascript
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY'
```

### 区块浏览器
- Sepolia Etherscan: https://sepolia.etherscan.io/

### 验证合约
```bash
# 验证示例
forge verify-contract \
  --chain sepolia \
  --num-of-optimizations 200 \
  --watch \
  --etherscan-api-key $ETHERSCAN_KEY \
  <CONTRACT_ADDRESS> \
  <CONTRACT_NAME>
```

## 重要提示

1. **所有地址都是确定性部署** - 使用 CREATE2 和 salt "GATOR"
2. **多链一致性** - 相同地址在所有支持的链上
3. **版本**: v1.3.0 (最新稳定版)
4. **审计状态**: ✅ 已审计

## MySBT 集成

### AAStar MySBT 合约
| 合约 | 地址 | 网络 |
|------|------|------|
| **MySBT** | `0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C` | Sepolia |

### 创建 MySBT Enforcer
```solidity
// 需要自行部署的自定义 Enforcer
contract MySBTGatedEnforcer is CaveatEnforcer {
    IMySBT constant MY_SBT = IMySBT(0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C);

    function beforeHook(...) public view override {
        require(MY_SBT.getUserSBT(delegator) > 0, "SBT required");
    }
}
```

## 支持的链

### 主网
- Ethereum, Polygon, BSC, Optimism, Arbitrum, Base, Linea, Gnosis

### 测试网
- Sepolia, Polygon Amoy, Base Sepolia, Optimism Sepolia, Arbitrum Sepolia

## 联系和支持

- GitHub: https://github.com/MetaMask/delegation-framework
- 文档: https://deepwiki.com/MetaMask/delegation-framework
- Discord: MetaMask 开发者社区