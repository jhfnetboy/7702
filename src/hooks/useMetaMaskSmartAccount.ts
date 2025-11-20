/**
 * MetaMask Smart Account Hook (重构版)
 * 使用 @metamask/smart-accounts-kit 和 EIP-5792/ERC-7715 标准
 *
 * 关键改动：
 * 1. 不再手动调用 signAuthorization（RPC 不支持）
 * 2. 使用 ERC-7715 requestExecutionPermissions（触发自动升级）
 * 3. 使用 EIP-5792 sendCalls（批量交易和 Gasless）
 * 4. 让 MetaMask 自动处理 EIP-7702 升级流程
 */

import { useState, useCallback } from 'react'
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  encodeFunctionData,
  parseEther,
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
} from 'viem'
import { sepolia } from 'viem/chains'

// ✅ 使用 smart-accounts-kit（正确的包）
import type {
  RequestExecutionPermissionsParameters,
  RequestExecutionPermissionsReturnType,
} from '@metamask/smart-accounts-kit/actions'

import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'

// ✅ 使用 viem 的 EIP-5792
import { eip5792Actions } from 'viem/experimental'

// 配置
import { CONTRACTS, getContractAddress } from '../config/shared-config-adapter'

// ==================== 类型定义 ====================

/**
 * 权限请求参数
 */
export interface PermissionRequestParams {
  sessionKey: Address // Dapp 生成的 Session Key 地址
  requireMySBT?: boolean // 是否需要 MySBT 验证
  maxAmount?: bigint // 最大转账金额（周期性限额）
  periodDuration?: number // 周期时长（秒）
  tokenAddress?: Address // ERC20 代币地址（可选，不指定则为 ETH）
  expiry?: number // 权限过期时间（秒）
}

/**
 * 批量转账参数
 */
export interface BatchTransferParams {
  recipients: Array<{
    address: Address
    amount: bigint
    token?: Address // ERC20 代币地址（可选）
  }>
  paymasterUrl?: string // 自定义 Paymaster 服务 URL（实现 Gasless）
}

/**
 * 钱包能力
 */
export interface WalletCapabilities {
  supportsAtomicBatch: boolean // 是否支持原子批量操作
  supportsPaymaster: boolean // 是否支持 Paymaster
  allCapabilities: Record<string, any> // 所有能力的原始数据
}

/**
 * Hook 状态
 */
interface SmartAccountState {
  permissions: RequestExecutionPermissionsReturnType | null
  isLoading: boolean
  error: string | null
}

// ==================== Hook ====================

export function useMetaMaskSmartAccount() {
  const [state, setState] = useState<SmartAccountState>({
    permissions: null,
    isLoading: false,
    error: null,
  })

  /**
   * 创建扩展的 WalletClient
   * 集成了 ERC-7715 和 EIP-5792 功能
   */
  const createExtendedClient = useCallback(() => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed')
    }

    return createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum),
    })
      .extend(erc7715ProviderActions()) // ERC-7715: 权限请求
      .extend(eip5792Actions()) // EIP-5792: 批量交易
  }, [])

  /**
   * 创建 PublicClient（用于读取链上数据）
   */
  const createPublicClientInstance = useCallback((): PublicClient => {
    return createPublicClient({
      chain: sepolia,
      transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
    })
  }, [])

  /**
   * 检查 MetaMask 钱包能力
   *
   * 用于确认钱包是否支持：
   * - atomicBatch: 原子批量操作
   * - paymasterService: Paymaster 服务（Gasless）
   */
  const checkCapabilities = useCallback(async (): Promise<WalletCapabilities> => {
    try {
      const client = createExtendedClient()

      const capabilities = await client.getCapabilities()

      const chainCapabilities = capabilities[sepolia.id] || {}

      return {
        supportsAtomicBatch: !!chainCapabilities.atomicBatch,
        supportsPaymaster: !!chainCapabilities.paymasterService,
        allCapabilities: capabilities,
      }
    } catch (error) {
      console.error('❌ Failed to get capabilities:', error)
      return {
        supportsAtomicBatch: false,
        supportsPaymaster: false,
        allCapabilities: {},
      }
    }
  }, [createExtendedClient])

  /**
   * 请求执行权限（ERC-7715）
   *
   * 这是关键方法！它会触发 MetaMask：
   * 1. 检测用户是 EOA
   * 2. 弹出"切换到 Smart Account"提示
   * 3. 用户确认后自动完成 EIP-7702 升级
   * 4. 显示权限规则（Caveats）
   * 5. 用户签署 Delegation
   *
   * ⚠️ 注意：目前 MetaMask 只支持内置的权限类型，自定义 Caveat 需要使用更底层的 API
   */
  const requestPermissions = useCallback(
    async (params: PermissionRequestParams): Promise<RequestExecutionPermissionsReturnType> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        console.log('📝 Requesting execution permissions with ERC-7715...')

        const client = createExtendedClient()

        // 构建权限请求
        const permissionRequests: RequestExecutionPermissionsParameters = []

        // 添加周期性限额权限
        if (params.maxAmount) {
          if (params.tokenAddress) {
            // ERC20 周期性限额
            permissionRequests.push({
              chainId: sepolia.id,
              expiry: Math.floor(Date.now() / 1000) + (params.expiry || 86400), // 默认 24 小时
              signer: {
                type: 'account',
                data: { address: params.sessionKey },
              },
              permission: {
                type: 'erc20-token-periodic',
                data: {
                  tokenAddress: params.tokenAddress,
                  periodAmount: params.maxAmount,
                  periodDuration: params.periodDuration || 86400, // 默认 24 小时周期
                },
              },
              isAdjustmentAllowed: false, // 不允许调整
            })
          } else {
            // 原生代币（ETH）周期性限额
            permissionRequests.push({
              chainId: sepolia.id,
              expiry: Math.floor(Date.now() / 1000) + (params.expiry || 86400),
              signer: {
                type: 'account',
                data: { address: params.sessionKey },
              },
              permission: {
                type: 'native-token-periodic',
                data: {
                  periodAmount: params.maxAmount,
                  periodDuration: params.periodDuration || 86400,
                },
              },
              isAdjustmentAllowed: false,
            })
          }
        }

        // TODO: MySBT 验证
        // 目前 requestExecutionPermissions 只支持内置权限类型
        // 自定义 Caveat（如 MySBT 验证）需要使用更底层的 createDelegation API
        if (params.requireMySBT) {
          console.warn(
            '⚠️ MySBT verification requires custom Caveat Enforcer, ' +
              'which is not yet supported by requestExecutionPermissions. ' +
              'Will implement using lower-level createDelegation API.'
          )
        }

        // 发起权限请求
        // MetaMask 会：
        // 1. 检测到用户是 EOA
        // 2. 弹出 UI："切换到 Smart Account"
        // 3. 用户确认 → 自动执行 EIP-7702 升级
        // 4. 显示权限规则
        // 5. 用户签署 Delegation
        const permissions = await client.requestExecutionPermissions(permissionRequests)

        console.log('✅ Permissions granted:', permissions)

        setState((prev) => ({
          ...prev,
          permissions,
          isLoading: false,
        }))

        return permissions
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to request permissions'
        console.error('❌ Permission request failed:', error)
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isLoading: false,
        }))
        throw error
      }
    },
    [createExtendedClient]
  )

  /**
   * 执行批量转账（EIP-5792）
   *
   * 使用 sendCalls API，MetaMask 会自动：
   * - 封装成 UserOperation
   * - 调用 Paymaster（如果提供）
   * - 调用 Bundler
   * - 执行批量交易
   *
   * 用户体验：一次确认，多笔交易原子执行
   */
  const batchTransfer = useCallback(
    async (params: BatchTransferParams): Promise<any> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        console.log('💸 Executing batch transfer with EIP-5792...')

        const client = createExtendedClient()

        // 构建批量调用
        const calls = params.recipients.map((recipient) => {
          if (recipient.token) {
            // ERC20 转账
            const transferData = encodeFunctionData({
              abi: [
                {
                  name: 'transfer',
                  type: 'function',
                  inputs: [
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                  outputs: [{ type: 'bool' }],
                },
              ],
              functionName: 'transfer',
              args: [recipient.address, recipient.amount],
            })

            return {
              to: recipient.token,
              value: 0n,
              data: transferData as Hash,
            }
          } else {
            // ETH 转账
            return {
              to: recipient.address,
              value: recipient.amount,
              data: '0x' as Hash,
            }
          }
        })

        console.log('📦 Batch calls prepared:', calls)

        // 使用 EIP-5792 sendCalls
        // MetaMask 会自动封装成 UserOperation
        const callResult = await client.sendCalls({
          calls,
          // 如果提供了 Paymaster URL，则实现 Gasless
          ...(params.paymasterUrl && {
            capabilities: {
              paymasterService: {
                url: params.paymasterUrl,
              },
            },
          }),
        })

        // sendCalls 返回的是 call ID (string)
        const callId = typeof callResult === 'string' ? callResult : callResult

        console.log('✅ Batch transfer submitted, call ID:', callId)

        // 等待交易完成
        console.log('⏳ Waiting for batch transfer to complete...')
        const statusResult = await client.waitForCallsStatus({ id: callId as any })

        console.log('✅ Batch transfer completed:', statusResult)

        setState((prev) => ({ ...prev, isLoading: false }))

        // 返回 call ID
        return callId
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to execute batch transfer'
        console.error('❌ Batch transfer failed:', error)
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isLoading: false,
        }))
        throw error
      }
    },
    [createExtendedClient]
  )

  /**
   * 获取批量调用状态
   */
  const getCallsStatus = useCallback(
    async (callId: string) => {
      try {
        const client = createExtendedClient()
        const status = await client.getCallsStatus({ id: callId })
        return status
      } catch (error) {
        console.error('❌ Failed to get calls status:', error)
        throw error
      }
    },
    [createExtendedClient]
  )

  /**
   * 在钱包中显示调用状态
   */
  const showCallsStatus = useCallback(
    async (callId: string) => {
      try {
        const client = createExtendedClient()
        await client.showCallsStatus({ id: callId })
      } catch (error) {
        console.error('❌ Failed to show calls status:', error)
        throw error
      }
    },
    [createExtendedClient]
  )

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      permissions: null,
      isLoading: false,
      error: null,
    })
  }, [])

  return {
    // 状态
    ...state,

    // 方法
    checkCapabilities,
    requestPermissions,
    batchTransfer,
    getCallsStatus,
    showCallsStatus,
    reset,

    // 工具
    contracts: CONTRACTS,
    createPublicClient: createPublicClientInstance,
  }
}

// 导出类型
export type { RequestExecutionPermissionsReturnType as PermissionsResponse }
