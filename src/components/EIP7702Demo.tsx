import React, { useState, useEffect } from 'react'
import { useEIP7702 } from '../hooks/useEIP7702'
import './EIP7702Demo.css'

export const EIP7702Demo: React.FC = () => {
  const { initializeContract, pingContract, loading, error, delegationTx, pingTx, getTransactionLink } =
    useEIP7702()

  // 地址从环境变量读取（公开）
  const relayAddress = import.meta.env.VITE_RELAY || ''
  const authorizerAddress = import.meta.env.VITE_AUTHORIZER || ''
  const defaultContractAddress = import.meta.env.VITE_DELEGATION_CONTRACT_ADDRESS || ''
  const defaultAuthorizerPrivateKey = import.meta.env.VITE_AUTHORIZER_PRIVATE_KEY || ''

  // 用户输入
  const [contractAddress, setContractAddress] = useState<string>(defaultContractAddress)
  const [authorizerPrivateKey, setAuthorizerPrivateKey] = useState<string>(defaultAuthorizerPrivateKey)
  const [authorizationSigned, setAuthorizationSigned] = useState(false)
  const [authorization, setAuthorization] = useState<any>(null)

  // 步骤状态
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [authorizedContractAddress, setAuthorizedContractAddress] = useState<string>('')
  const [eoaAuthorized, setEoaAuthorized] = useState<boolean>(false)

  // 检查 EOA 是否已授权
  const checkEOAStatus = async () => {
    try {
      const { publicClient } = await import('../config/viem')
      const { privateKeyToAccount } = await import('viem/accounts')

      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      const code = await publicClient.getBytecode({ address: authorizer.address })

      const isAuthorized = code !== undefined && code !== '0x' && code.length > 2
      setEoaAuthorized(isAuthorized)

      if (isAuthorized) {
        console.log('✅ EOA 已授权，代码:', code)
        setAuthorizedContractAddress(contractAddress)
        setCurrentStep(2)
      } else {
        console.log('❌ EOA 未授权')
      }

      return isAuthorized
    } catch (err) {
      console.error('检查 EOA 状态失败:', err)
      return false
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
      })

      // 签署授权
      const auth = await walletClient.signAuthorization({
        account: eoa,
        contractAddress: contractAddress as `0x${string}`,
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
    const isAuthorized = await checkEOAStatus()
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
      const { encodeFunctionData } = await import('viem')
      const { walletClient } = await import('../config/viem')
      const { delegationAbi } = await import('../config/contract')

      console.group('📤 步骤2: Relay广播初始化交易')
      console.log('========== 交易前的数据 ==========')

      const encodedData = encodeFunctionData({
        abi: delegationAbi,
        functionName: 'initialize',
      })

      // 获取 Authorizer EOA 地址
      const { privateKeyToAccount } = await import('viem/accounts')
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      console.log('Relay Account (walletClient):', walletClient.account?.address)
      console.log('Authorizer EOA (to):', authorizer.address)
      console.log('Delegation Contract:', contractAddress)
      console.log('合约初始化调用数据:', encodedData)
      console.log('交易参数:', {
        from: walletClient.account?.address,
        to: authorizer.address,
        data: encodedData,
        authorizationList: [authorization],
      })

      // 广播初始化交易 - Relay 发送到 Authorizer EOA 地址
      const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        data: encodedData,
        to: authorizer.address,
        gas: 1000000n, // 增加 gas limit
      })

      console.log('========== 交易后的响应 ==========')
      console.log('交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)
      console.log('交易详情:', {
        hash: hash,
        from: walletClient.account?.address,
        to: authorizer.address,
        delegationContract: contractAddress,
        status: '已提交到链上',
      })
      console.log('✓ 步骤2完成: 成功广播交易')
      console.groupEnd()

      setAuthorizedContractAddress(contractAddress)

      // 等待交易确认后重新检查 EOA 状态
      const { publicClient } = await import('../config/viem')
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

  // 步骤3-4: 验证授权并执行交易
  const handleVerifyAndExecute = async () => {
    if (!eoaAuthorized && !authorizedContractAddress) {
      console.error('错误: 请先完成授权（步骤1和2），或 EOA 已授权')
      return
    }

    try {
      setCurrentStep(3)
      const { encodeFunctionData } = await import('viem')
      const { walletClient } = await import('../config/viem')
      const { delegationAbi } = await import('../config/contract')

      console.group('✅ 步骤3-4: 验证授权并执行交易')
      console.log('========== 验证执行前的数据 ==========')

      // 获取 Authorizer EOA 地址
      const { privateKeyToAccount } = await import('viem/accounts')
      const authorizer = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      console.log('Relay Account:', walletClient.account?.address)
      console.log('Authorizer EOA:', authorizer.address)
      console.log('Delegation Contract:', authorizedContractAddress)

      const encodedData = encodeFunctionData({
        abi: delegationAbi,
        functionName: 'ping',
      })

      console.log('Ping 合约调用数据:', encodedData)
      console.log('验证参数:', {
        from: walletClient.account?.address,
        to: authorizer.address,
        data: encodedData,
        purpose: '通过委托合约调用 ping() 函数',
      })

      // 执行 ping 交易 - 发送到 Authorizer EOA
      const hash = await pingContract(authorizer.address)

      console.log('========== 验证执行后的响应 ==========')
      console.log('Ping 交易哈希:', hash)
      console.log('交易链接:', `https://sepolia.etherscan.io/tx/${hash}`)
      console.log('验证结果:', {
        hash: hash,
        status: '已成功执行',
        purpose: '验证授权者已成功授权 Delegation 合约',
        note: '交易由 Relay 账户发起，但在授权者地址上执行',
      })
      console.log('✓ 步骤3-4完成: 已验证授权者授权了 Delegation 合约')
      console.groupEnd()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '验证失败'
      console.error('步骤3失败:', errorMessage)
      console.error('完整错误:', err)
    }
  }

  return (
    <div className="eip7702-demo">
      <h2>EIP-7702 演示应用</h2>

      {/* 账户信息展示 */}
      <div className="env-config">
        <h3>📋 账户信息</h3>
        <div className="env-item-full">
          <label>Relay 账户（中继 - 广播交易并支付Gas）:</label>
          <code className="full-key">{relayAddress || '未配置'}</code>
        </div>
        <div className="env-item-full">
          <label>Authorizer 账户（授权者 - 自己签署授权的EOA）:</label>
          <code className="full-key">{authorizerAddress || '未配置'}</code>
          {eoaAuthorized && <span style={{ color: 'green', marginLeft: '10px' }}>✅ 已授权</span>}
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
            disabled={eoaAuthorized || !authorizationSigned || !!delegationTx}
            className="btn btn-primary"
          >
            {eoaAuthorized ? '✓ EOA已授权' : delegationTx ? '✓ 已广播' : '广播交易'}
          </button>
          {delegationTx && (
            <div className="success-message">
              <a href={getTransactionLink(delegationTx)} target="_blank" rel="noopener noreferrer" className="tx-link">
                查看交易: {delegationTx.substring(0, 10)}...
              </a>
            </div>
          )}
        </div>

        {/* 步骤3: 验证授权 */}
        <div className={`step-card ${currentStep >= 3 ? 'active' : ''}`}>
          <div className="step-header">
            <span className="step-number">3</span>
            <h4>验证授权</h4>
          </div>
          <p>验证EOA是否成功关联了Delegation合约</p>
          <button
            onClick={handleVerifyAndExecute}
            disabled={(!eoaAuthorized && !delegationTx) || !!pingTx}
            className="btn btn-primary"
          >
            {pingTx ? '✓ 已验证' : '验证并执行交易'}
          </button>
          {pingTx && (
            <div className="success-message">
              <p>✓ 验证成功！EOA已成功授权Delegation合约</p>
              <a href={getTransactionLink(pingTx)} target="_blank" rel="noopener noreferrer" className="tx-link">
                查看交易: {pingTx.substring(0, 10)}...
              </a>
            </div>
          )}
        </div>
      </div>

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
