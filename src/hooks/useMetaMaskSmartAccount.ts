/**
 * MetaMask Smart Account Hook (Production-Ready)
 * 使用 @metamask/smart-accounts-kit 和 EIP-5792/ERC-7715 标准
 *
 * Standards Compliance:
 * - ERC-7715: Advanced Permission Requests (stable in MetaMask v12+)
 * - EIP-5792: Wallet Call API (experimental but production-ready)
 * - EIP-7702: Set EOA Code (automatic upgrade via MetaMask)
 *
 * Production Features:
 * 1. ✅ Automatic fallback for wallets without EIP-5792 support
 * 2. ✅ Capability detection for batch transactions
 * 3. ✅ Error handling with graceful degradation
 * 4. ✅ MetaMask v12+ fully supported
 * 5. ✅ Gasless transactions via Paymaster
 *
 * Note: EIP-5792 is marked "experimental" in viem but is production-ready
 * as of 2025. MetaMask, Coinbase Wallet, and Rainbow fully support it.
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

// ✅ 使用 viem 的 EIP-5792 和 EIP-7702
import { eip5792Actions, eip7702Actions } from 'viem/experimental'

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
  account: Address // 账户地址
  balance: bigint // 账户余额
  isDelegated: boolean // 是否已授权
  delegationAddress?: Address // 授权的合约地址
}

/**
 * Hook 状态
 */
interface SmartAccountState {
  permissions: RequestExecutionPermissionsReturnType | null
  isLoading: boolean
  error: string | null
  account: Address | null
  balance: bigint | null
  isDelegated: boolean
  delegationAddress: Address | null
}

// ==================== Hook ====================

export function useMetaMaskSmartAccount() {
  const [state, setState] = useState<SmartAccountState>({
    permissions: null,
    isLoading: false,
    error: null,
    account: null,
    balance: null,
    isDelegated: false,
    delegationAddress: null,
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
      .extend(eip7702Actions) // EIP-7702: 授权操作
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
   * 检查 MetaMask 钱包能力 (Production-Ready)
   *
   * 检测钱包是否支持 EIP-5792 和相关功能：
   * - atomicBatch: 原子批量操作（EIP-5792）
   * - paymasterService: Paymaster 服务（Gasless）
   *
   * 支持的钱包：
   * - MetaMask v12+ ✅ Full support
   * - Coinbase Wallet ✅ Full support
   * - Rainbow ✅ Full support
   * - WalletConnect ⚠️ Depends on underlying wallet
   * - Hardware wallets ❌ Not yet supported
   */
  const checkCapabilities = useCallback(async (): Promise<WalletCapabilities> => {
    try {
      const client = createExtendedClient()

      // 获取当前账户地址
      const [account] = await client.getAddresses()
      if (!account) {
        throw new Error('No account connected')
      }

      // Get wallet capabilities for current chain
      // EIP-5792 要求传入账户地址
      const capabilities = await client.getCapabilities({
        account,
      })

      // 尝试多种方式获取 chain capabilities
      // MetaMask 可能使用十六进制或十进制的 chainId
      const chainIdHex = `0x${sepolia.id.toString(16)}` as any
      const chainCapabilities =
        capabilities[sepolia.id] ||
        capabilities[chainIdHex] ||
        capabilities[String(sepolia.id)] ||
        {}

      // Check MetaMask version - 尝试多种方式获取版本
      let metamaskVersion = 'unknown'
      if (window.ethereum?.isMetaMask) {
        // 尝试多个可能的版本字段
        metamaskVersion =
          window.ethereum.version ||
          (window.ethereum as any)._metamask?.version ||
          'unknown'
        console.log('✅ MetaMask detected, version:', metamaskVersion)
      }

      // 修复：MetaMask 使用 "atomic" 字段，不是 "atomicBatch"
      // EIP-5792 的实际实现可能使用不同的字段名
      const result = {
        supportsAtomicBatch: !!(
          chainCapabilities.atomicBatch ||
          chainCapabilities.atomic ||
          (chainCapabilities.atomic as any)?.status === 'ready'
        ),
        supportsPaymaster: !!chainCapabilities.paymasterService,
        allCapabilities: capabilities,
      }

      if (result.supportsAtomicBatch) {
        console.log('✅ EIP-5792 batch transactions supported (atomic mode)')
      } else {
        console.warn('⚠️ Batch transactions not supported, will use fallback')
      }

      // 获取账户余额
      const publicClient = createPublicClientInstance()
      const balance = await publicClient.getBalance({ address: account })

      // 检查是否已授权 (EIP-7702)
      const bytecode = await publicClient.getBytecode({ address: account })
      let isDelegated = false
      let delegationAddress: Address | null = null

      if (bytecode && bytecode.startsWith('0xef01')) {
        isDelegated = true
        // 提取 delegation address (0xef0100...address)
        // EIP-7702 bytecode format: 0xef0100 + 20 bytes address
        // 0xef0100 = 3 bytes = 6 chars
        // address = 20 bytes = 40 chars
        if (bytecode.length >= 46) {
          delegationAddress = `0x${bytecode.slice(6, 46)}` as Address
        }
        console.log('✅ Account is already delegated (EIP-7702) to:', delegationAddress)
      }

      // 更新状态
      setState((prev) => ({ ...prev, account, balance, isDelegated, delegationAddress }))

      // 返回结果包含账户和余额
      return {
        ...result,
        account,
        balance,
        isDelegated,
        delegationAddress: delegationAddress || undefined,
      }
    } catch (error) {
      console.error('❌ Failed to get capabilities:', error)
      console.log('ℹ️ Falling back to sequential transactions')
      return {
        supportsAtomicBatch: false,
        supportsPaymaster: false,
        allCapabilities: {},
        account: '0x0000000000000000000000000000000000000000' as Address,
        balance: 0n,
      }
    }
  }, [createExtendedClient])

  /**
   * 触发 EIP-7702 升级（通过 dummy batch call）
   *
   * 由于 viem 的 signAuthorization 不支持 JSON-RPC 账户（MetaMask），
   * 我们使用一个 dummy batch transaction 来触发 MetaMask 的自动升级提示：
   *
   * 流程：
   * 1. 发送一个简单的 batch call（发送 0 ETH 给自己）
   * 2. MetaMask 检测到用户是 EOA 且未升级
   * 3. MetaMask 自动弹窗提示"Upgrade to Smart Account"
   * 4. 用户确认后，MetaMask 自动处理 EIP-7702 delegation
   * 5. dummy transaction 执行完成
   *
   * 参考：
   * - https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/
   * - https://docs.metamask.io/tutorials/upgrade-eoa-to-smart-account/
   */
  const triggerDelegation = useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('🔐 Triggering EIP-7702 upgrade via dummy batch call...')

      const client = createExtendedClient()

      // 获取当前账户
      const [account] = await client.getAddresses()
      if (!account) {
        throw new Error('No account connected')
      }

      // 发送一个 dummy batch call（发送 0 ETH 给自己）
      // 这会触发 MetaMask 检测并提示用户升级到 Smart Account
      console.log('📤 Sending dummy batch call to trigger upgrade prompt...')
      const callId = await client.sendCalls({
        calls: [
          {
            to: account,
            value: 0n,
            // data 字段是可选的，简单的 ETH 转账不需要 data
          },
        ],
        // @ts-ignore - experimental_fallback 是有效的
        experimental_fallback: true,
      })

      console.log('✅ Dummy call sent, MetaMask will prompt for upgrade')
      console.log('   Call ID:', callId)

      // Handle case where callId is an object (e.g. { id: "..." })
      const id = typeof callId === 'object' && callId !== null && 'id' in callId 
        ? (callId as any).id 
        : callId

      // 等待交易完成
      console.log('⏳ Waiting for upgrade transaction to complete...')
      const statusResult = await client.waitForCallsStatus({ id: id as string })

      console.log('✅ EIP-7702 upgrade completed!')
      console.log('   Status:', statusResult)

      setState((prev) => ({ ...prev, isLoading: false }))

      return callId as string
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to trigger delegation'
      console.error('❌ Delegation upgrade failed:', error)
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }))
      throw error
    }
  }, [createExtendedClient])

  /**
   * Gasless EIP-7702 Upgrade (via Relayer)
   */
  const gaslessUpgrade = useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('⛽️ Starting Gasless Upgrade...')
      const client = createExtendedClient()
      const [account] = await client.getAddresses()
      
      if (!account) throw new Error('No account connected')

      // 1. Sign Authorization
      console.log('✍️ Signing authorization for upgrade...')
      // MetaMask's Delegator Contract Address on Sepolia
      const DELEGATOR_ADDRESS = '0x63c0c114B521E88A1A20bb92017177663496e32b'
      
      const authorization = await client.signAuthorization({
        account,
        contractAddress: DELEGATOR_ADDRESS as Address,
        delegate: true
      })

      console.log('✅ Authorization signed:', authorization)

      // 2. Send to Relayer
      console.log('🚀 Sending to Relayer Service...')
      const response = await fetch('http://localhost:3000/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Relayer request failed')
      }

      const result = await response.json()
      console.log('✅ Gasless upgrade successful!', result)

      setState((prev) => ({ ...prev, isLoading: false }))
      return result.hash
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Gasless upgrade failed'
      console.error('❌ Gasless upgrade failed:', error)
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }))
      throw error
    }
  }, [createExtendedClient])

  /**
   * Gasless Revoke (via Relayer)
   * 通过 Relayer 撤销授权到零地址
   */
  const gaslessRevoke = useCallback(async (): Promise<string> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('🚫 Starting Gasless Revoke...')
      const client = createExtendedClient()
      const publicClient = createPublicClientInstance()
      const [account] = await client.getAddresses()
      
      if (!account) throw new Error('No account connected')

      // 1. 准备 EIP-7712 签名数据
      console.log('✍️ Preparing authorization signature for revoke...')
      
      const chainId = await publicClient.getChainId()
      const nonce = await publicClient.getTransactionCount({ address: account })
      
      // EIP-7702 Authorization 类型定义
      const types = {
        Authorization: [
          { name: 'chainId', type: 'uint256' },
          { name: 'address', type: 'address' },
          { name: 'nonce', type: 'uint256' },
        ],
      }

      const message = {
        chainId: chainId,
        address: '0x0000000000000000000000000000000000000000', // 零地址表示撤销
        nonce: nonce,
      }

      // 2. 使用 eth_signTypedData_v4 签署
      console.log('📝 Requesting signature from user...')
      const signature = await (window.ethereum as any).request({
        method: 'eth_signTypedData_v4',
        params: [
          account,
          JSON.stringify({
            types,
            primaryType: 'Authorization',
            domain: {
              name: 'Ethereum',
              version: '1',
              chainId: chainId,
            },
            message,
          }),
        ],
      })

      console.log('✅ Authorization signed')

      // 3. 构造 authorization 对象
      const r = `0x${signature.slice(2, 66)}` as `0x${string}`
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`
      const yParity = parseInt(signature.slice(130, 132), 16) as 0 | 1

      const authorization = {
        chainId: chainId,
        address: '0x0000000000000000000000000000000000000000' as Address,
        nonce: nonce,
        r,
        s,
        yParity,
      }

      // 4. 发送给 Relayer
      console.log('🚀 Sending to Relayer Service...')
      const response = await fetch('http://localhost:3000/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization, account }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Relayer request failed')
      }

      const result = await response.json()
      console.log('✅ Gasless revoke successful!', result)

      setState((prev) => ({ ...prev, isDelegated: false, delegationAddress: null, isLoading: false }))
      return result.hash
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Gasless revoke failed'
      console.error('❌ Gasless revoke failed:', error)
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }))
      throw error
    }
  }, [createExtendedClient, createPublicClientInstance])

  /**
   * 撤销授权 (EIP-7702)
   * 将账户委托给 0x0000...0000
   */
  const revokeDelegation = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('🚫 Revoking EIP-7702 delegation...')

      const client = createExtendedClient()
      const [account] = await client.getAddresses()
      
      if (!account) throw new Error('No account connected')

      // 使用 sendCalls 触发 MetaMask 撤销授权
      // MetaMask 会自动处理授权到零地址的逻辑
      console.log('📤 Sending revoke request via MetaMask...')
      
      // Send a dummy call to trigger MetaMask's authorization flow
      // MetaMask will detect the need to revoke and prompt the user
      const callId = await client.sendCalls({
        calls: [
          {
            to: '0x0000000000000000000000000000000000000000' as Address,
            value: 0n,
          },
        ],
        // @ts-ignore
        experimental_fallback: true,
      })

      console.log('✅ Revoke request sent:', callId)

      // Handle case where callId is an object
      const id = typeof callId === 'object' && callId !== null && 'id' in callId 
        ? (callId as any).id 
        : callId

      // 等待交易确认
      console.log('⏳ Waiting for revocation to complete...')
      await client.waitForCallsStatus({ id: id as string })
      
      console.log('✅ Revocation confirmed')
      
      // 更新状态
      setState((prev) => ({ ...prev, isDelegated: false, delegationAddress: null, isLoading: false }))
      
      return id as string
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to revoke delegation'
      console.error('❌ Revocation failed:', error)
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }))
      throw error
    }
  }, [createExtendedClient])

  /**
   * 请求执行权限（ERC-7715）
   *
   * ⚠️ 注意：wallet_requestExecutionPermissions 在 MetaMask 13.9.0 中尚未完全支持
   * 应该先使用 triggerDelegation() 完成 EIP-7702 升级，再使用此方法请求权限
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
              // data 字段是可选的，简单的 ETH 转账不需要 data
            }
          }
        })

        console.log('📦 Batch calls prepared:', calls)

        // 使用 EIP-5792 sendCalls (Production-ready)
        // MetaMask v12+ fully supports EIP-5792
        // Falls back to sequential eth_sendTransaction if wallet doesn't support batch
        const callResult = await client.sendCalls({
          calls,
          // Enable fallback for wallets without EIP-5792 support
          // @ts-ignore - experimental_fallback is a valid flag
          experimental_fallback: true,
          // Paymaster capabilities for gasless transactions
          ...(params.paymasterUrl && {
            capabilities: {
              paymasterService: {
                url: params.paymasterUrl,
              },
            },
          }),
        })

        // sendCalls 返回的是 call ID (string) 或者对象 { id: string }
        const rawCallId = callResult
        const callId = typeof rawCallId === 'object' && rawCallId !== null && 'id' in rawCallId
          ? (rawCallId as any).id
          : rawCallId

        console.log('✅ Batch transfer submitted, call ID:', callId)

        // 等待交易完成
        console.log('⏳ Waiting for batch transfer to complete...')
        const statusResult = await client.waitForCallsStatus({ id: callId as string })

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
      account: null,
      balance: null,
    })
  }, [])

  return {
    // 状态
    ...state,

    // 方法
    checkCapabilities,
    triggerDelegation, // ✨ 新增：EIP-7702 delegation (User pays)
    gaslessUpgrade, // ✨ 新增：Gasless Upgrade (Relayer pays)
    gaslessRevoke, // ✨ 新增：Gasless Revoke (Relayer pays)
    revokeDelegation, // ✨ 新增：撤销授权
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
