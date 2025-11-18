import React, { useState, useEffect } from 'react'
import { useEIP7702 } from '../hooks/useEIP7702'
import { contracts, ContractType } from '../config/contract'
import './EIP7702Demo.css'

export const EIP7702Demo: React.FC = () => {
  const { initializeContract, pingContract, loading, error, delegationTx, pingTx, getTransactionLink } =
    useEIP7702()

  // Helper: 获取 Etherscan 地址链接
  const getAddressLink = (address: string) => `https://sepolia.etherscan.io/address/${address}`

  // 地址从环境变量读取（公开）
  const relayAddress = import.meta.env.VITE_RELAY || ''
  const authorizerAddress = import.meta.env.VITE_AUTHORIZER || ''
  const defaultAuthorizerPrivateKey = import.meta.env.VITE_AUTHORIZER_PRIVATE_KEY || ''

  // 合约选择
  const [selectedContract, setSelectedContract] = useState<ContractType>('delegation')
  const [contractAddress, setContractAddress] = useState<string>(contracts.delegation.address)

  // Gas 支付方式
  const [gasPaymentMode, setGasPaymentMode] = useState<'self' | 'relay'>('relay')

  // 用户输入
  const [authorizerPrivateKey, setAuthorizerPrivateKey] = useState<string>(defaultAuthorizerPrivateKey)
  const [authorizationSigned, setAuthorizationSigned] = useState(false)
  const [authorization, setAuthorization] = useState<any>(null)

  // 步骤状态
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [authorizedContractAddress, setAuthorizedContractAddress] = useState<string>('')
  const [eoaAuthorized, setEoaAuthorized] = useState<boolean>(false)
  const [detectedContract, setDetectedContract] = useState<ContractType | null>(null)

  // 转账相关状态 (仅 sponsoredTransfer 合约)
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  const [authorizerBalance, setAuthorizerBalance] = useState<string>('0')
  const [transferTx, setTransferTx] = useState<string | null>(null)

  // 批量转账状态
  const [batchRecipients, setBatchRecipients] = useState<string>('')
  const [batchAmounts, setBatchAmounts] = useState<string>('')
  const [batchTransferTx, setBatchTransferTx] = useState<string | null>(null)

  // 合约切换时更新地址并重置状态
  useEffect(() => {
    const newAddress = contracts[selectedContract].address
    setContractAddress(newAddress)
    setAuthorizationSigned(false)
    setAuthorization(null)
    setEoaAuthorized(false)
    setAuthorizedContractAddress('')
    setCurrentStep(0)
    setTransferTx(null)
    setBatchTransferTx(null)
  }, [selectedContract])

  // 检查 EOA 是否已授权，并检测授权给了哪个合约
  const checkEOAStatus = async (): Promise<{ isAuthorized: boolean; detectedContract: ContractType | null }> => {
    try {
      const { publicClient } = await import('../config/viem')
      const { privateKeyToAccount } = await import('viem/accounts')

      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      const code = await publicClient.getBytecode({ address: authorizer.address })

      const isAuthorized = code !== undefined && code !== '0x' && code.length > 2
      setEoaAuthorized(isAuthorized)

      if (isAuthorized && code) {
        console.log('✅ EOA 已授权，代码:', code)

        // EIP-7702 code 格式: 0xef0100 + 合约地址(20字节)
        // 提取合约地址 (去掉 0xef0100 前缀，即前6个字符 + 0x)
        const contractAddr = '0x' + code.slice(8) // 0xef0100 = 8 characters
        console.log('检测到的合约地址:', contractAddr)

        // 对比两个合约地址，识别是哪个
        let detected: ContractType | null = null
        if (contractAddr.toLowerCase() === contracts.delegation.address.toLowerCase()) {
          detected = 'delegation'
          console.log('✅ 识别为 Basic Delegation 合约')
        } else if (contractAddr.toLowerCase() === contracts.sponsoredTransfer.address.toLowerCase()) {
          detected = 'sponsoredTransfer'
          console.log('✅ 识别为 SponsoredTransfer 合约')
        } else {
          console.log('⚠️ 未识别的合约地址:', contractAddr)
        }

        setDetectedContract(detected)
        setAuthorizedContractAddress(contractAddr)
        setCurrentStep(3) // 跳到 Step 3 验证步骤
        return { isAuthorized: true, detectedContract: detected }
      } else {
        console.log('❌ EOA 未授权')
        setDetectedContract(null)
        return { isAuthorized: false, detectedContract: null }
      }
    } catch (err) {
      console.error('检查 EOA 状态失败:', err)
      return { isAuthorized: false, detectedContract: null }
    }
  }

  // 组件加载时检查状态
  useEffect(() => {
    if (authorizerPrivateKey && contractAddress) {
      checkEOAStatus()
    }
  }, [])

  // 步骤1: 签署授权
  const handleSignAuthorization = async () => {
    if (!contractAddress) {
      console.error('错误: 请输入合约地址')
      return
    }
    if (!authorizerPrivateKey) {
      console.error('错误: 缺少授权者私钥')
      return
    }

    try {
      setCurrentStep(1)
      const { privateKeyToAccount } = await import('viem/accounts')
      const { walletClient } = await import('../config/viem')

      console.group('📋 步骤1: 签署授权')
      console.log('========== 签署前的数据 ==========')

      const eoa = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      console.log('Authorizer EOA 账户信息:', {
        address: eoa.address,
        type: 'EOA Account',
      })

      console.log('签署参数:', {
        account: eoa.address,
        contractAddress: contractAddress,
        chainId: 11155111, // Sepolia
        executor: gasPaymentMode === 'self' ? 'self' : undefined,
        gasPaymentMode: gasPaymentMode === 'self' ? 'Authorizer 自己' : 'Relay 代付',
      })

      // 签署授权
      // 如果是 self 模式，需要设置 executor: 'self'
      const auth = await walletClient.signAuthorization({
        account: eoa,
        contractAddress: contractAddress as `0x${string}`,
        ...(gasPaymentMode === 'self' && { executor: 'self' }),
      })

      console.log('========== 签署后的授权数据 ==========')
      console.log('授权对象结构:', auth)
      console.log('授权对象详细:', {
        chainId: auth.chainId,
        nonce: auth.nonce,
        r: auth.r,
        s: auth.s,
        v: auth.v,
      })
      console.log('授权列表:', [auth])
      console.log('注意: 授权对象中不包含 contractAddress，contractAddress 是在签署时的请求参数')
      console.log('✓ 步骤1完成: 成功签署授权')
      console.groupEnd()

      setAuthorization(auth)
      setAuthorizationSigned(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '签署授权失败'
      console.error('步骤1失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 步骤2: Relay广播交易
  const handleBroadcastTransaction = async () => {
    // 先检查 EOA 是否已经授权
    const { isAuthorized } = await checkEOAStatus()
    if (isAuthorized) {
      console.log('✅ EOA 已经授权，跳过步骤2，可以直接执行步骤3')
      return
    }

    if (!authorization) {
      const msg = '请先完成步骤1：签署授权'
      console.error(msg)
      return
    }

    try {
      setCurrentStep(2)
      const { encodeFunctionData, createWalletClient, http } = await import('viem')
      const { walletClient, publicClient } = await import('../config/viem')
      const { delegationAbi } = await import('../config/contract')
      const { sepolia } = await import('viem/chains')

      const isSelfMode = gasPaymentMode === 'self'
      const modeText = isSelfMode ? 'Authorizer 自己' : 'Relay'

      console.group(`📤 步骤2: ${modeText}广播初始化交易`)
      console.log('========== 交易前的数据 ==========')

      const encodedData = encodeFunctionData({
        abi: delegationAbi,
        functionName: 'initialize',
      })

      // 获取 Authorizer EOA 地址
      const { privateKeyToAccount } = await import('viem/accounts')
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      // 根据模式选择 wallet client
      const activeWalletClient = isSelfMode
        ? createWalletClient({
            account: authorizer,
            chain: sepolia,
            transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
          })
        : walletClient

      console.log('Gas 支付方式:', modeText)
      console.log('交易发起账户:', activeWalletClient.account?.address)
      console.log('Authorizer EOA (to):', authorizer.address)
      console.log('Delegation Contract:', contractAddress)
      console.log('合约初始化调用数据:', encodedData)
      console.log('交易参数:', {
        from: activeWalletClient.account?.address,
        to: authorizer.address,
        data: encodedData,
        authorizationList: [authorization],
      })

      // 广播初始化交易 - 发送到 Authorizer EOA 地址
      const hash = await activeWalletClient.sendTransaction({
        authorizationList: [authorization],
        data: encodedData,
        to: authorizer.address,
        gas: 1000000n,
      })

      console.log('========== 交易后的响应 ==========')
      console.log('交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)
      console.log('交易详情:', {
        hash: hash,
        from: activeWalletClient.account?.address,
        to: authorizer.address,
        delegationContract: contractAddress,
        gasPaymentMode: modeText,
        status: '已提交到链上',
      })
      console.log(`✓ 步骤2完成: ${modeText}成功广播交易`)
      console.groupEnd()

      setAuthorizedContractAddress(contractAddress)

      // 等待交易确认后重新检查 EOA 状态
      await publicClient.waitForTransactionReceipt({ hash })
      await checkEOAStatus()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '广播交易失败'
      console.error('交易失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 撤回授权：发送交易到 0x0000...地址
  const handleRevokeAuthorization = async () => {
    if (!eoaAuthorized) {
      console.error('错误: EOA 未授权，无需撤回')
      return
    }

    try {
      const { encodeFunctionData } = await import('viem')
      const { walletClient, publicClient } = await import('../config/viem')
      const { privateKeyToAccount } = await import('viem/accounts')

      console.group('🗑️ 撤回 EIP-7702 授权')
      console.log('========== 撤回前的数据 ==========')

      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      const zeroAddress = '0x0000000000000000000000000000000000000000'

      console.log('Relay Account:', walletClient.account?.address)
      console.log('Authorizer EOA:', authorizer.address)
      console.log('撤回目标:', zeroAddress)

      // 签署指向零地址的授权
      const authorization = await walletClient.signAuthorization({
        account: authorizer,
        contractAddress: zeroAddress as `0x${string}`,
      })

      console.log('撤回授权已签署:', authorization)

      // 发送交易撤回授权
      const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        to: authorizer.address,
        gas: 100000n,
      })

      console.log('========== 撤回后的响应 ==========')
      console.log('交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)

      // 等待确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('交易状态:', receipt.status)
      console.log('✓ 授权已撤回')
      console.groupEnd()

      // 重新检查状态并重置相关状态
      await checkEOAStatus()
      setAuthorizedContractAddress('')
      setAuthorizationSigned(false)
      setAuthorization(null)
      setCurrentStep(0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '撤回授权失败'
      console.error('撤回失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 步骤3: 验证授权 - 检测 EOA 授权给了哪个合约
  const handleVerifyAuthorization = async () => {
    if (!authorizerPrivateKey) {
      console.error('错误: 缺少授权者私钥')
      return
    }

    console.group('✅ 步骤3: 验证授权')
    console.log('正在检测 EOA 授权状态...')

    const { isAuthorized, detectedContract: detected } = await checkEOAStatus()

    if (isAuthorized && detected) {
      console.log('✓ 步骤3完成: 已识别授权合约类型 -', contracts[detected].name)
    } else if (isAuthorized) {
      console.log('⚠️ EOA 已授权，但未识别合约类型')
    } else {
      console.log('❌ EOA 未授权')
    }

    console.groupEnd()
  }

  // 步骤4: 执行交易 - 根据检测到的合约类型执行不同操作
  const handleExecuteTransaction = async () => {
    if (!detectedContract) {
      console.error('错误: 请先验证授权（步骤3）')
      return
    }

    try {
      setCurrentStep(4)
      const { privateKeyToAccount } = await import('viem/accounts')
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      console.group('✅ 步骤4: 执行交易')
      console.log('检测到的合约类型:', contracts[detectedContract].name)
      console.log('Authorizer EOA:', authorizer.address)

      if (detectedContract === 'delegation') {
        // Basic Delegation: 执行 ping
        console.log('执行操作: ping()')
        const hash = await pingContract(authorizer.address)
        console.log('Ping 交易哈希:', hash)
        console.log('✓ 步骤4完成: ping 执行成功')
      } else if (detectedContract === 'sponsoredTransfer') {
        // SponsoredTransfer: 执行批量转账测试
        console.log('执行操作: 批量转账测试')
        console.log('请在下方转账测试区域进行转账操作')
        console.log('✓ 步骤4: 请使用转账功能验证授权')
      }

      console.groupEnd()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '执行失败'
      console.error('步骤4失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 查询 Authorizer 余额
  const fetchAuthorizerBalance = async () => {
    try {
      const { publicClient } = await import('../config/viem')
      const { privateKeyToAccount } = await import('viem/accounts')
      const { formatEther } = await import('viem')

      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      const balance = await publicClient.getBalance({ address: authorizer.address })
      setAuthorizerBalance(formatEther(balance))
    } catch (err) {
      console.error('查询余额失败:', err)
    }
  }

  // 执行转账 (仅 sponsoredTransfer 合约)
  const handleTransferETH = async () => {
    if (!recipientAddress || !transferAmount) {
      console.error('错误: 请输入接收地址和转账金额')
      return
    }

    // 验证地址格式：不能包含逗号（防止误填批量转账数据）
    if (recipientAddress.includes(',')) {
      const errorMsg = '❌ 单笔转账只能填写一个地址！如需转账给多个地址，请使用下方的"批量转账"功能'
      console.error(errorMsg)
      alert(errorMsg)
      return
    }

    // 验证金额格式：不能包含逗号
    if (transferAmount.includes(',')) {
      const errorMsg = '❌ 单笔转账只能填写一个金额！如需批量转账，请使用下方的"批量转账"功能'
      console.error(errorMsg)
      alert(errorMsg)
      return
    }

    try {
      const { encodeFunctionData, parseEther, createWalletClient, http } = await import('viem')
      const { walletClient, publicClient } = await import('../config/viem')
      const { sponsoredTransferAbi } = await import('../config/contract')
      const { privateKeyToAccount } = await import('viem/accounts')
      const { sepolia } = await import('viem/chains')

      const isSelfMode = gasPaymentMode === 'self'
      const modeText = isSelfMode ? 'Authorizer 自己' : 'Relay'
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      const amount = parseEther(transferAmount)

      console.group(`💸 执行转账 (Gas: ${modeText})`)
      console.log('========== 转账前的数据 ==========')
      console.log('From (Authorizer):', authorizer.address)
      console.log('To (Recipient):', recipientAddress)
      console.log('Amount:', transferAmount, 'ETH')
      console.log('Gas Payer:', modeText)

      // 编码 transferETH 调用
      const data = encodeFunctionData({
        abi: sponsoredTransferAbi,
        functionName: 'transferETH',
        args: [recipientAddress as `0x${string}`, amount],
      })

      // 根据模式选择 wallet client
      const activeWalletClient = isSelfMode
        ? createWalletClient({
            account: authorizer,
            chain: sepolia,
            transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
          })
        : walletClient

      // 发起转账交易
      const hash = await activeWalletClient.sendTransaction({
        to: authorizer.address, // 发送到 Authorizer EOA (合约代码在这里)
        data,
        gas: 100000n,
      })

      console.log('========== 转账后的响应 ==========')
      console.log('交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)
      console.groupEnd()

      setTransferTx(hash)

      // 等待确认后更新余额
      await publicClient.waitForTransactionReceipt({ hash })
      await fetchAuthorizerBalance()

      console.log('✅ 转账成功！')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '转账失败'
      console.error('转账失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 执行批量转账
  const handleBatchTransfer = async () => {
    if (!batchRecipients || !batchAmounts) {
      console.error('错误: 请输入接收地址列表和金额列表')
      return
    }

    try {
      const { encodeFunctionData, parseEther, createWalletClient, http } = await import('viem')
      const { walletClient, publicClient } = await import('../config/viem')
      const { sponsoredTransferAbi } = await import('../config/contract')
      const { privateKeyToAccount } = await import('viem/accounts')
      const { sepolia } = await import('viem/chains')

      // 解析输入
      const recipients = batchRecipients.split(',').map((addr) => addr.trim() as `0x${string}`)
      const amounts = batchAmounts.split(',').map((amount) => parseEther(amount.trim()))

      if (recipients.length !== amounts.length) {
        console.error('错误: 接收地址数量和金额数量不匹配')
        return
      }

      const isSelfMode = gasPaymentMode === 'self'
      const modeText = isSelfMode ? 'Authorizer 自己' : 'Relay'
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      console.group(`💸💸 批量转账 (Gas: ${modeText})`)
      console.log('========== 批量转账前的数据 ==========')
      console.log('From (Authorizer):', authorizer.address)
      console.log('Recipients:', recipients)
      console.log('Amounts (ETH):', batchAmounts.split(','))
      console.log('Total Recipients:', recipients.length)
      console.log('Gas Payer:', modeText)

      // 编码 batchTransfer 调用
      const data = encodeFunctionData({
        abi: sponsoredTransferAbi,
        functionName: 'batchTransfer',
        args: [recipients, amounts],
      })

      // 根据模式选择 wallet client
      const activeWalletClient = isSelfMode
        ? createWalletClient({
            account: authorizer,
            chain: sepolia,
            transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
          })
        : walletClient

      // 发起批量转账交易
      const hash = await activeWalletClient.sendTransaction({
        to: authorizer.address, // 发送到 Authorizer EOA (合约代码在这里)
        data,
        gas: 300000n, // 批量转账需要更多 gas
      })

      console.log('========== 批量转账后的响应 ==========')
      console.log('交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)
      console.groupEnd()

      setBatchTransferTx(hash)

      // 等待确认后更新余额
      await publicClient.waitForTransactionReceipt({ hash })
      await fetchAuthorizerBalance()

      console.log('✅ 批量转账成功！')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量转账失败'
      console.error('批量转账失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  // 授权后加载余额
  useEffect(() => {
    if (eoaAuthorized && selectedContract === 'sponsoredTransfer' && authorizerPrivateKey) {
      fetchAuthorizerBalance()
    }
  }, [eoaAuthorized, selectedContract, authorizerPrivateKey])

  return (
    <div className="eip7702-demo">
      <h2>EIP-7702 演示应用</h2>

      {/* 合约选择 */}
      <div className="contract-selector-section">
        <h3>🎯 选择 Delegation 合约</h3>
        <div className="contract-options">
          {(Object.keys(contracts) as ContractType[]).map((key) => {
            const contract = contracts[key]
            return (
              <div
                key={key}
                className={`contract-option ${selectedContract === key ? 'selected' : ''}`}
                onClick={() => !authorizationSigned && setSelectedContract(key)}
                style={{ cursor: authorizationSigned ? 'not-allowed' : 'pointer' }}
              >
                <div className="contract-radio">
                  <input
                    type="radio"
                    checked={selectedContract === key}
                    onChange={() => setSelectedContract(key)}
                    disabled={authorizationSigned}
                  />
                </div>
                <div className="contract-info">
                  <div className="contract-name">{contract.name}</div>
                  <div className="contract-description">{contract.description}</div>
                  <div className="contract-features">
                    功能: {contract.features.join(', ')}
                  </div>
                  <div className="contract-address">
                    <small>合约: </small>
                    <a
                      href={getAddressLink(contract.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="address-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contract.address}
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gas 支付方式选择 */}
      <div className="gas-payment-section">
        <h3>⛽ Gas 支付方式</h3>
        <div className="gas-payment-options">
          <div
            className={`gas-option ${gasPaymentMode === 'relay' ? 'selected' : ''}`}
            onClick={() => !authorizationSigned && setGasPaymentMode('relay')}
            style={{ cursor: authorizationSigned ? 'not-allowed' : 'pointer' }}
          >
            <input
              type="radio"
              checked={gasPaymentMode === 'relay'}
              onChange={() => setGasPaymentMode('relay')}
              disabled={authorizationSigned}
            />
            <div className="gas-option-content">
              <strong>Relay 代付 Gas (免 Gas 体验)</strong>
              <p>Relay 账户发起交易并支付 gas，您无需支付任何费用</p>
            </div>
          </div>
          <div
            className={`gas-option ${gasPaymentMode === 'self' ? 'selected' : ''}`}
            onClick={() => !authorizationSigned && setGasPaymentMode('self')}
            style={{ cursor: authorizationSigned ? 'not-allowed' : 'pointer' }}
          >
            <input
              type="radio"
              checked={gasPaymentMode === 'self'}
              onChange={() => setGasPaymentMode('self')}
              disabled={authorizationSigned}
            />
            <div className="gas-option-content">
              <strong>我自己支付 Gas</strong>
              <p>使用 Authorizer 私钥发起交易，gas 从您的账户扣除</p>
            </div>
          </div>
        </div>
      </div>

      {/* 账户信息展示 */}
      <div className="env-config">
        <h3>📋 账户信息</h3>
        <div className="account-info-row">
          <div className="account-info-item">
            <label>Relay 账户（中继 - 广播交易并支付Gas）:</label>
            <a
              href={getAddressLink(relayAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="address-link"
            >
              {relayAddress || '未配置'}
            </a>
          </div>
          <div className="account-info-item">
            <label>Authorizer 账户（授权者 - 自己签署授权的EOA）:</label>
            <a
              href={getAddressLink(authorizerAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="address-link"
            >
              {authorizerAddress || '未配置'}
            </a>
            {eoaAuthorized && <span style={{ color: 'green', marginLeft: '10px' }}>✅ 已授权</span>}
          </div>
        </div>
      </div>

      {/* 输入私钥和合约地址 */}
      <div className="contract-input-section">
        <h3>🔑 配置授权参数</h3>

        <div className="form-group">
          <label>授权者私钥（Authorizer Private Key）:</label>
          <input
            type="password"
            value={authorizerPrivateKey}
            onChange={(e) => setAuthorizerPrivateKey(e.target.value)}
            placeholder="0x..."
            disabled={authorizationSigned}
            className="contract-address-input"
          />
          {authorizerPrivateKey && !authorizationSigned && (
            <p className="info-text">✓ 私钥已输入</p>
          )}
        </div>

        <div className="form-group">
          <label>Delegation 合约地址:</label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            disabled={authorizationSigned}
            className="contract-address-input"
          />
          {contractAddress && !authorizationSigned && (
            <p className="info-text">✓ 合约地址已输入，准备签署授权</p>
          )}
          {authorizedContractAddress && (
            <p className="success-text">✓ 已授权的合约地址: {authorizedContractAddress}</p>
          )}
        </div>

        <div className="form-group">
          <button onClick={checkEOAStatus} className="btn btn-secondary">
            🔍 检查 EOA 授权状态
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 5个步骤 */}
      <div className="steps-flow">
        {/* 步骤1: 签署授权 */}
        <div className={`step-card ${currentStep >= 1 ? 'active' : ''}`}>
          <div className="step-header">
            <span className="step-number">1</span>
            <h4>签署授权</h4>
          </div>
          <p>EOA签署7702授权消息，指定要委托的合约</p>
          <button
            onClick={handleSignAuthorization}
            disabled={eoaAuthorized || authorizationSigned || !contractAddress || !authorizerPrivateKey || loading}
            className="btn btn-primary"
          >
            {eoaAuthorized ? '✓ EOA已授权' : authorizationSigned ? '✓ 已签署' : '签署授权'}
          </button>
        </div>

        {/* 步骤2: Relay广播交易 */}
        <div className={`step-card ${currentStep >= 2 ? 'active' : ''}`}>
          <div className="step-header">
            <span className="step-number">2</span>
            <h4>Relay广播交易</h4>
          </div>
          <p>Relay账户广播包含授权的交易到链上</p>
          <button
            onClick={handleBroadcastTransaction}
            disabled={eoaAuthorized || !authorizationSigned || !!delegationTx || loading}
            className="btn btn-primary"
          >
            {loading && !delegationTx && !eoaAuthorized ? '广播中...' : eoaAuthorized ? '✓ EOA已授权' : delegationTx ? '✓ 已广播' : '广播交易'}
          </button>
          {delegationTx && (
            <div className="success-message">
              <a href={getTransactionLink(delegationTx)} target="_blank" rel="noopener noreferrer" className="tx-link">
                查看交易: {delegationTx.substring(0, 10)}...
              </a>
            </div>
          )}
        </div>

        {/* 步骤3: 验证授权 - 检测合约类型 */}
        <div className={`step-card ${currentStep >= 3 ? 'active' : ''}`}>
          <div className="step-header">
            <span className="step-number">3</span>
            <h4>验证授权</h4>
          </div>
          <p>检测 EOA 是否已授权，并识别授权给了哪个合约</p>
          <button
            onClick={handleVerifyAuthorization}
            disabled={!delegationTx || !!detectedContract}
            className="btn btn-primary"
          >
            {detectedContract ? '✓ 已检测' : '检测授权状态'}
          </button>
          {detectedContract && (
            <div className="success-message">
              <p>✓ 检测成功！授权合约类型: {contracts[detectedContract].name}</p>
              <p>合约地址: {authorizedContractAddress}</p>
            </div>
          )}
        </div>

        {/* 步骤4: 执行交易 - 根据检测到的合约类型执行不同操作 */}
        {detectedContract && (
          <div className={`step-card ${currentStep >= 4 ? 'active' : ''}`}>
            <div className="step-header">
              <span className="step-number">4</span>
              <h4>执行交易</h4>
            </div>
            {detectedContract === 'delegation' ? (
              <>
                <p>执行 ping() 函数验证授权</p>
                <button
                  onClick={handleExecuteTransaction}
                  disabled={!!pingTx}
                  className="btn btn-primary"
                >
                  {pingTx ? '✓ 已执行 ping' : '执行 ping 交易'}
                </button>
                {pingTx && (
                  <div className="success-message">
                    <p>✓ Ping 执行成功！</p>
                    <a href={getTransactionLink(pingTx)} target="_blank" rel="noopener noreferrer" className="tx-link">
                      查看交易: {pingTx.substring(0, 10)}...
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>SponsoredTransfer 合约已授权</p>
                <p>请在下方"转账测试区域"执行转账操作进行验证</p>
                <div className="info-message">
                  <p>ℹ️ 此合约支持批量转账和余额查询功能</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 转账测试区域 - 仅 sponsoredTransfer 合约且已授权后显示 */}
      {selectedContract === 'sponsoredTransfer' && eoaAuthorized && (
        <div className="transfer-test-section">
          <h3>💸 转账测试 ({gasPaymentMode === 'self' ? 'Authorizer 自己付 Gas' : 'Relay 代付 Gas'})</h3>

          <div className="balance-info">
            <div className="balance-item">
              <label>Authorizer EOA 余额:</label>
              <code>{authorizerBalance} ETH</code>
              <button onClick={fetchAuthorizerBalance} className="btn-refresh">
                🔄 刷新
              </button>
            </div>
            <div className="balance-item">
              <label>Gas 支付方:</label>
              <code>{gasPaymentMode === 'self' ? `Authorizer (${authorizerAddress})` : `Relay (${relayAddress})`}</code>
            </div>
          </div>

          <div className="transfer-form">
            <h4 style={{ marginBottom: '16px', color: '#059669' }}>💰 单笔转账（一次转给一个地址）</h4>
            <div className="form-group">
              <label>接收地址 (To) - 只填写一个地址:</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x... (单个地址，不能用逗号分隔)"
                className="contract-address-input"
              />
              <small style={{ color: '#dc2626' }}>⚠️ 只能填写一个地址！多个地址请使用下方"批量转账"</small>
            </div>

            <div className="form-group">
              <label>转账金额 (ETH):</label>
              <input
                type="number"
                step="0.001"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.001"
                className="contract-address-input"
              />
            </div>

            <button
              onClick={handleTransferETH}
              className="btn btn-primary"
              disabled={!recipientAddress || !transferAmount || loading}
            >
              执行转账
            </button>

            {transferTx && (
              <div className="success-message">
                <p>✅ 转账成功！</p>
                <a href={`https://sepolia.etherscan.io/tx/${transferTx}`} target="_blank" rel="noopener noreferrer" className="tx-link">
                  查看交易: {transferTx.substring(0, 10)}...
                </a>
              </div>
            )}
          </div>

          <div className="transfer-info">
            <h4>ℹ️ 单笔转账说明:</h4>
            <ul>
              <li>💰 转账金额从 Authorizer EOA 扣除</li>
              <li>⛽ Gas 费用由 {gasPaymentMode === 'self' ? 'Authorizer 自己' : 'Relay 账户'} 支付</li>
              <li>{gasPaymentMode === 'self' ? '🔴 您需要支付 gas 费用' : '✅ 您无需支付任何 gas 费用'}</li>
            </ul>
          </div>

          {/* 批量转账表单 */}
          <div className="batch-transfer-form" style={{ marginTop: '30px', paddingTop: '30px', borderTop: '3px solid #f59e0b', background: '#fffbeb', padding: '24px', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '16px', color: '#d97706', fontSize: '18px' }}>📦 批量转账（一次转给多个地址）</h4>
            <div style={{ background: '#fef3c7', border: '2px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
              <strong style={{ color: '#92400e' }}>⚡ EIP-7702 核心优势：</strong>
              <span style={{ color: '#78350f' }}> 传统 EOA 需要发起多笔交易，EIP-7702 可以一次完成多笔转账！</span>
            </div>

            <div className="form-group">
              <label>接收地址列表 (用逗号分隔):</label>
              <textarea
                value={batchRecipients}
                onChange={(e) => setBatchRecipients(e.target.value)}
                placeholder="0x123...,0x456...,0x789..."
                className="contract-address-input"
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <small style={{ color: '#78350f' }}>示例: 0xRecipient1,0xRecipient2,0xRecipient3</small>
            </div>

            <div className="form-group">
              <label>转账金额列表 (ETH，用逗号分隔):</label>
              <input
                type="text"
                value={batchAmounts}
                onChange={(e) => setBatchAmounts(e.target.value)}
                placeholder="0.001,0.002,0.003"
                className="contract-address-input"
              />
              <small style={{ color: '#78350f' }}>示例: 0.001,0.002,0.003 (数量需与地址列表一致)</small>
            </div>

            <button
              onClick={handleBatchTransfer}
              className="btn btn-primary"
              disabled={!batchRecipients || !batchAmounts || loading}
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              💸 执行批量转账
            </button>

            {batchTransferTx && (
              <div className="success-message">
                <p>✅ 批量转账成功！</p>
                <a href={`https://sepolia.etherscan.io/tx/${batchTransferTx}`} target="_blank" rel="noopener noreferrer" className="tx-link">
                  查看交易: {batchTransferTx.substring(0, 10)}...
                </a>
              </div>
            )}

            <div className="transfer-info" style={{ marginTop: '16px', background: '#fef3c7', borderColor: '#fcd34d' }}>
              <h4>🎯 批量转账核心优势:</h4>
              <ul>
                <li>⚡ <strong>传统 EOA</strong>: 需要发起多笔交易，每笔都要签名和支付 gas</li>
                <li>✅ <strong>EIP-7702 + SponsoredTransfer</strong>: 一次交易完成多笔转账！</li>
                <li>💡 通过合约代码注入，EOA 获得批量操作能力</li>
                <li>💰 所有转账金额从 Authorizer EOA 扣除</li>
                <li>⛽ 只需支付一次 gas (由 {gasPaymentMode === 'self' ? 'Authorizer' : 'Relay'} 支付)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 最终结果 */}
      {(authorizedContractAddress || eoaAuthorized) && (
        <div className="result-section">
          <h3>✅ 授权完成</h3>
          <div className="result-item">
            <label>委托的合约地址:</label>
            <code>{authorizedContractAddress || contractAddress}</code>
          </div>
          <div className="result-item">
            <label>授权者地址:</label>
            <code>{authorizerAddress || '未配置'}</code>
          </div>
          <div className="result-item">
            <label>中继账户地址:</label>
            <code>{relayAddress || '未配置'}</code>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleRevokeAuthorization}
              className="btn btn-secondary"
              disabled={!eoaAuthorized}
              style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
            >
              🗑️ 撤回授权
            </button>
          </div>
        </div>
      )}

      {/* 步骤说明 */}
      <div className="instructions">
        <h4>⚙️ EIP-7702 工作流程</h4>
        <ol>
          <li><strong>步骤1 - Authorizer签署授权:</strong> 授权者EOA使用自己的私钥签署EIP-7702授权消息，指定要委托的Delegation合约地址</li>
          <li><strong>步骤2 - Relay广播交易:</strong> 中继账户使用签署好的授权，广播一个包含authorizationList的交易到链上，在Authorizer地址上绑定合约</li>
          <li><strong>步骤3 - 链上绑定:</strong> 交易被打包确认后，Delegation合约被正式绑定到Authorizer的地址</li>
          <li><strong>步骤4 - 验证和交互:</strong> Relay直接向Authorizer地址发送交易，调用Delegation合约的函数，无需额外授权</li>
          <li><strong>步骤5 - Gas赞助:</strong> 所有交易的gas费用都由Relay账户支付，Authorizer实现无gas交易</li>
        </ol>
      </div>
    </div>
  )
}
