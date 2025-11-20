/**
 * Shared Config Adapter
 * 从 @aastar/shared-config 包获取所有合约地址和 ABI
 * 禁止硬编码地址！
 */

// TODO: 需要更新 @aastar/shared-config 包以导出这些函数
// 目前使用占位符，等待 shared-config 包更新

export type NetworkName = 'sepolia' | 'mainnet' | 'polygon' | 'base'

// 合约名称类型
export type ContractName =
  | 'DelegationManager'
  | 'EIP7702StatelessDeleGator'
  | 'MySBT'
  | 'MySBTGatedEnforcer'
  | 'BatchTransferEnforcer'
  | 'RelayService'
  | 'Paymaster'
  | 'SponsoredTransferDelegationV2'
  | 'SponsoredTransferDelegationV2_1'

// 临时硬编码（等待 shared-config 包更新）
// TODO: 这些地址必须从 @aastar/shared-config 获取
const TEMP_ADDRESSES: Record<ContractName, `0x${string}`> = {
  // MetaMask 官方合约（Sepolia）
  DelegationManager: '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3',
  EIP7702StatelessDeleGator: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B',

  // MySBT 合约（来自项目）
  MySBT: '0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C',

  // 我们现有的合约
  SponsoredTransferDelegationV2: '0x997D16b7aF16220b3FbbA21c55dFC5bba4217B05',
  SponsoredTransferDelegationV2_1: '0x0000000000000000000000000000000000000000', // 待部署

  // 自定义 Enforcers（待部署）
  MySBTGatedEnforcer: '0x0000000000000000000000000000000000000000',
  BatchTransferEnforcer: '0x0000000000000000000000000000000000000000',

  // 服务合约（待部署）
  RelayService: '0x0000000000000000000000000000000000000000',
  Paymaster: '0x0000000000000000000000000000000000000000',
}

/**
 * 从 shared-config 获取合约地址
 * @param name 合约名称
 * @param network 网络名称
 * @param optional 是否可选（未部署时返回 undefined 而不是抛错）
 * @returns 合约地址或 undefined
 */
export function getContractAddress(
  name: ContractName,
  network: NetworkName = 'sepolia',
  optional: boolean = false
): `0x${string}` | undefined {
  // TODO: 实际实现应该是:
  // import { getAddress } from '@aastar/shared-config'
  // return getAddress(name, network) as `0x${string}`

  const address = TEMP_ADDRESSES[name]

  if (!address || address === '0x0000000000000000000000000000000000000000') {
    if (optional) {
      console.log(`ℹ️ Contract ${name} not deployed on ${network} (optional)`)
      return undefined
    }
    throw new Error(`合约 ${name} 在 ${network} 网络上未找到或未部署`)
  }

  return address
}

/**
 * 从 shared-config 获取合约 ABI
 * @param name 合约名称
 * @returns 合约 ABI
 */
export function getContractABI(name: ContractName): any {
  // TODO: 实际实现应该是:
  // import { getABI } from '@aastar/shared-config'
  // return getABI(name)

  console.warn(`⚠️ 需要从 shared-config 获取 ABI for ${name}`)

  // 临时返回基础 ABI
  return []
}

/**
 * 获取所有必需的合约地址
 */
export function getAllContracts(network: NetworkName = 'sepolia') {
  return {
    // MetaMask 官方合约（必需）
    delegationManager: getContractAddress('DelegationManager', network),
    eip7702Delegator: getContractAddress('EIP7702StatelessDeleGator', network),

    // AAStar 合约（必需）
    mySBT: getContractAddress('MySBT', network),
    sponsoredTransferV2: getContractAddress('SponsoredTransferDelegationV2', network),

    // 自定义 Enforcers（可选 - 待部署）
    mySBTEnforcer: getContractAddress('MySBTGatedEnforcer', network, true),
    batchTransferEnforcer: getContractAddress('BatchTransferEnforcer', network, true),

    // 服务合约（可选 - 待部署）
    relayService: getContractAddress('RelayService', network, true),
    paymaster: getContractAddress('Paymaster', network, true),
  } as const
}

/**
 * 检查合约是否已部署
 */
export function isContractDeployed(name: ContractName, network: NetworkName = 'sepolia'): boolean {
  try {
    const address = getContractAddress(name, network)
    return address !== '0x0000000000000000000000000000000000000000'
  } catch {
    return false
  }
}

/**
 * 获取已部署的合约列表
 */
export function getDeployedContracts(network: NetworkName = 'sepolia'): ContractName[] {
  const allContracts: ContractName[] = [
    'DelegationManager',
    'EIP7702StatelessDeleGator',
    'MySBT',
    'MySBTGatedEnforcer',
    'BatchTransferEnforcer',
    'RelayService',
    'Paymaster',
    'SponsoredTransferDelegationV2',
    'SponsoredTransferDelegationV2_1',
  ]

  return allContracts.filter(name => isContractDeployed(name, network))
}

// 默认导出所有合约地址（Sepolia）
export const CONTRACTS = getAllContracts('sepolia')