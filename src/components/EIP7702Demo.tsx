import React, { useState, useEffect } from 'react'
import { useEIP7702 } from '../hooks/useEIP7702'
import './EIP7702Demo.css'

export const EIP7702Demo: React.FC = () => {
  const { initializeContract, pingContract, loading, error, delegationTx, pingTx, getTransactionLink, reset } =
    useEIP7702()

  // 地址从环境变量读取（公开）
  const relayAddress = import.meta.env.VITE_RELAY || ''
  const authorizerAddress = import.meta.env.VITE_AUTHORIZER || ''

  // 用户输入
  const [contractAddress, setContractAddress] = useState<string>('')
  const [authorizerPrivateKey, setAuthorizerPrivateKey] = useState<string>('')
  const [authorizationSigned, setAuthorizationSigned] = useState(false)
  const [authorization, setAuthorization] = useState<any>(null)

  // 步骤状态
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [authorizedContractAddress, setAuthorizedContractAddress] = useState<string>('')

  // 步骤1: 签署授权
  const handleSignAuthorization = async () => {
    if (!contractAddress) {
      alert('请输入合约地址')
      return
    }
    if (!authorizerPrivateKey) {
      alert('缺少授权者私钥')
      return
    }

    try {
      setCurrentStep(1)
      const { privateKeyToAccount } = await import('viem/accounts')
      const { walletClient } = await import('../config/viem')

      const eoa = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      // 签署授权
      const auth = await walletClient.signAuthorization({
        account: eoa,
        contractAddress: contractAddress as `0x${string}`,
      })

      setAuthorization(auth)
      setAuthorizationSigned(true)
      console.log('✓ 步骤1完成: 签署授权')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '签署授权失败'
      alert(errorMessage)
      console.error('Error:', err)
    }
  }

  // 步骤2: Relay广播交易
  const handleBroadcastTransaction = async () => {
    if (!authorization) {
      alert('请先签署授权')
      return
    }

    try {
      setCurrentStep(2)
      const { privateKeyToAccount } = await import('viem/accounts')
      const { walletClient } = await import('../config/viem')
      const { encodeFunctionData } = await import('viem')
      const { delegationAbi } = await import('../config/contract')

      const eoa = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)

      // 广播初始化交易
      const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        data: encodeFunctionData({
          abi: delegationAbi,
          functionName: 'initialize',
        }),
        to: eoa.address,
      })

      setAuthorizedContractAddress(contractAddress)
      console.log('✓ 步骤2完成: 广播交易，哈希:', hash)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '广播交易失败'
      alert(errorMessage)
      console.error('Error:', err)
    }
  }

  // 步骤3-4: 验证授权并执行交易
  const handleVerifyAndExecute = async () => {
    if (!authorizedContractAddress) {
      alert('请先完成授权')
      return
    }

    try {
      setCurrentStep(3)
      const { privateKeyToAccount } = await import('viem/accounts')
      const eoa = privateKeyToAccount(authorizerPrivateKey as `0x${string}`)
      await pingContract(eoa.address)
      console.log('✓ 步骤3-4完成: 验证并执行交易')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '验证失败'
      alert(errorMessage)
      console.error('Error:', err)
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
            disabled={authorizationSigned || !contractAddress || !authorizerPrivateKey || loading}
            className="btn btn-primary"
          >
            {authorizationSigned ? '✓ 已签署' : '签署授权'}
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
            disabled={!authorizationSigned || !!delegationTx}
            className="btn btn-primary"
          >
            {delegationTx ? '✓ 已广播' : '广播交易'}
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
            disabled={!delegationTx || !!pingTx}
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
      {authorizedContractAddress && (
        <div className="result-section">
          <h3>✅ 授权完成</h3>
          <div className="result-item">
            <label>委托的合约地址:</label>
            <code>{authorizedContractAddress}</code>
          </div>
          <div className="result-item">
            <label>授权者地址:</label>
            <code>{authorizerAddress || '未配置'}</code>
          </div>
          <div className="result-item">
            <label>中继账户地址:</label>
            <code>{relayAddress || '未配置'}</code>
          </div>
          <button onClick={reset} className="btn btn-secondary">
            重置演示
          </button>
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
