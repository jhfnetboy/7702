/**
 * MetaMask Smart Account Component (重构版)
 * 使用 ERC-7715 和 EIP-5792 标准
 *
 * 新的用户流程（简化）：
 * 1. 连接钱包 + 检查能力
 * 2. 请求权限（自动触发 EIP-7702 升级）
 * 3. 执行 Gasless 批量转账
 */

import React, { useState } from 'react'
import { parseEther, formatEther, type Address } from 'viem'
import { useMetaMaskSmartAccount } from '../hooks/useMetaMaskSmartAccount'
import './MetaMaskSmartAccount.css'

export function MetaMaskSmartAccount() {
  const {
    permissions,
    isLoading,
    error,
    account,
    balance,
    checkCapabilities,
    triggerDelegation,
    gaslessUpgrade,
    revokeDelegation,
    requestPermissions,
    batchTransfer,
    reset,
    isDelegated,
  } = useMetaMaskSmartAccount()

  // UI 状态
  // 流程：connect → upgrade → transfer
  const [step, setStep] = useState<'connect' | 'upgrade' | 'transfer'>('connect')
  const [upgradeCallId, setUpgradeCallId] = useState<string>('')
  const [capabilities, setCapabilities] = useState<any>(null)
  const [sessionKey, setSessionKey] = useState<Address>('0x0000000000000000000000000000000000000000')
  const [recipients, setRecipients] = useState<Array<{ address: string; amount: string }>>([
    { address: '', amount: '' },
  ])
  const [maxAmount, setMaxAmount] = useState('1')
  const [paymasterUrl, setPaymasterUrl] = useState('')
  const [enablePaymaster, setEnablePaymaster] = useState(false)
  const [enableGaslessUpgrade, setEnableGaslessUpgrade] = useState(false) // Toggle for gasless upgrade
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(false)
  const [delegationAddress, setDelegationAddress] = useState('0x63c0c114B521E88A1A20bb92017177663496e32b') // Default 7702 delegation address
  const [batchCallId, setBatchCallId] = useState<string>('') // Store batch transfer call ID

  /**
   * 步骤 1: 连接钱包并检查能力
   */
  const handleConnect = async () => {
    try {
      // 检查 MetaMask 是否安装
      if (!window.ethereum) {
        console.error('❌ MetaMask not installed')
        // 使用 hook 的 error state 显示错误
        throw new Error('请安装 MetaMask 浏览器扩展')
      }

      // 请求连接
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      // 检查钱包能力（包含账户和余额）
      const caps = await checkCapabilities()
      setCapabilities(caps)

      // 检查 EIP-5792 支持情况
      // 温和地显示通知，不使用侵入性的 alert/confirm
      if (!caps.supportsAtomicBatch) {
        setShowUpgradeNotice(true)
        console.log(
          `ℹ️ EIP-5792 批量交易检测为不支持。\n` +
          `MetaMask 版本: ${window.ethereum?.version || 'unknown'}\n` +
          `这可能是检测问题，或网络配置问题。\n` +
          `应用将使用兼容模式（逐笔确认）。`
        )
      } else {
        setShowUpgradeNotice(false)
      }

      // 检查是否已授权，如果是则直接进入转账步骤
      if (caps.isDelegated) {
        console.log('✅ 检测到已授权，跳过升级步骤')
        setStep('transfer')
      } else {
        // 进入升级步骤
        setStep('upgrade')
      }
    } catch (err) {
      console.error('❌ 连接失败:', err)
      // 错误已通过 hook 的 error state 显示，无需 alert
    }
  }

  /**
   * 步骤 2: 触发 EIP-7702 升级
   */
  const handleUpgrade = async () => {
    try {
      let callId;
      if (enableGaslessUpgrade) {
        console.log('🚀 Initiating Gasless Upgrade...')
        callId = await gaslessUpgrade()
      } else {
        console.log('🔐 Initiating Standard Upgrade...')
        callId = await triggerDelegation()
      }
      setUpgradeCallId(callId)

      // 成功后进入转账步骤
      setStep('transfer')
    } catch (err) {
      console.error('❌ Upgrade failed:', err)
      // 错误已通过 hook 的 error state 显示，无需 alert
    }
  }

  /**
   * 撤销授权
   */
  const handleRevoke = async () => {
    if (!window.confirm('确定要撤销授权吗？这将使您的账户恢复为普通 EOA。')) {
      return
    }

    try {
      console.log('🚫 Revoking delegation...')
      await revokeDelegation()
      console.log('✅ Revocation successful')
      
      // 撤销成功后返回连接步骤
      setStep('connect')
      setCapabilities(null)
      alert('授权已撤销，账户已恢复为 EOA')
    } catch (err) {
      console.error('❌ Revocation failed:', err)
    }
  }

  /**
   * 步骤 3: 执行批量转账
   */
  const handleBatchTransfer = async () => {
    try {
      // 验证输入
      const validRecipients = recipients.filter((r) => r.address && r.amount)
      if (validRecipients.length === 0) {
        console.warn('⚠️ 请至少添加一个有效的接收地址')
        return
      }

      console.log('💸 Executing batch transfer...')

      const callId = await batchTransfer({
        recipients: validRecipients.map((r) => ({
          address: r.address as Address,
          amount: parseEther(r.amount),
        })),
        paymasterUrl: enablePaymaster ? paymasterUrl : undefined,
      })

      console.log('✅ Batch transfer completed, call ID:', callId)
      setBatchCallId(callId)
      console.log(`🎉 批量转账成功！`)
    } catch (err) {
      console.error('❌ 批量转账失败:', err)
      // 错误已通过 hook 的 error state 显示，无需 alert
    }
  }

  /**
   * 添加接收地址
   */
  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '' }])
  }

  /**
   * 删除接收地址
   */
  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  /**
   * 更新接收地址
   */
  const updateRecipient = (index: number, field: 'address' | 'amount', value: string) => {
    const newRecipients = [...recipients]
    newRecipients[index][field] = value
    setRecipients(newRecipients)
  }

  /**
   * 重置所有状态
   */
  const handleReset = () => {
    reset()
    setStep('connect')
    setCapabilities(null)
    setUpgradeCallId('')
    setSessionKey('0x0000000000000000000000000000000000000000')
    setRecipients([{ address: '', amount: '' }])
    setMaxAmount('1')
  }

  return (
    <div className="metamask-smart-account">
      <div className="card">
        <h2>MetaMask Smart Account (EIP-7702)</h2>
        <p className="subtitle">使用 ERC-7715 和 EIP-5792 标准</p>

        {/* 错误显示 */}
        {error && (
          <div className="error-box">
            <strong>❌ 错误:</strong> {error}
          </div>
        )}

        {/* 步骤 1: 连接钱包 */}
        {step === 'connect' && (
          <div className="step-section">
            <h3>步骤 1: 连接钱包</h3>
            <p>连接 MetaMask 并检查钱包能力</p>

            {/* 账户信息显示 - 使用 capabilities 中的数据 */}
            {capabilities?.account && capabilities.account !== '0x0000000000000000000000000000000000000000' && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                background: '#f0f7ff',
                border: '1px solid #4a90e2',
                borderRadius: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>已连接账户</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' }}>
                      {capabilities.account.slice(0, 6)}...{capabilities.account.slice(-4)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>余额</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4a90e2' }}>
                      {parseFloat(formatEther(capabilities.balance)).toFixed(4)} ETH
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleConnect} disabled={isLoading || !!capabilities?.account} className="primary-button">
              {isLoading ? '连接中...' : capabilities?.account ? '✓ 已连接' : '连接 MetaMask'}
            </button>

            {capabilities && (
              <div className="info-box">
                <h4>钱包能力:</h4>
                <ul>
                  <li>
                    原子批量操作: {capabilities.supportsAtomicBatch ? '✅ 支持' : '❌ 不支持'}
                  </li>
                  <li>Paymaster: {capabilities.supportsPaymaster ? '✅ 支持' : '❌ 不支持'}</li>
                  <li>
                    MetaMask 版本: {window.ethereum?.version || window.ethereum?._metamask?.version || 'unknown'}
                  </li>
                </ul>

                {/* 能力检测通知 */}
                {!capabilities.supportsAtomicBatch && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#e3f2fd',
                    border: '1px solid #90caf9',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    <strong>ℹ️ 兼容模式</strong>
                    <p style={{ margin: '8px 0', fontSize: '13px', lineHeight: '1.5' }}>
                      {(window.ethereum as any)?.version && parseFloat((window.ethereum as any).version) >= 12
                        ? `检测到 MetaMask ${(window.ethereum as any).version}（最新版本），但 EIP-5792 能力未检测到。这可能是：`
                        : '当前 MetaMask 版本不支持 EIP-5792 批量交易。'}
                    </p>
                    {(window.ethereum as any)?.version && parseFloat((window.ethereum as any).version) >= 12 ? (
                      <ul style={{ margin: '8px 0 8px 20px', fontSize: '12px', lineHeight: '1.6' }}>
                        <li>网络配置问题（某些网络可能未启用）</li>
                        <li>API 检测方式问题（正在改进中）</li>
                        <li>MetaMask 实验性功能未开启</li>
                      </ul>
                    ) : (
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1976d2', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}
                      >
                        升级到 MetaMask v12+ →
                      </a>
                    )}
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#555' }}>
                      💡 应用将使用兼容模式（逐笔确认），功能完全可用。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 步骤 2: EIP-7702 升级 */}
        {step === 'upgrade' && (
          <div className="step-section">
            <h3>步骤 2: EIP-7702 Smart Account 升级</h3>
            
            {capabilities?.isDelegated ? (
              <div className="success-box">
                <strong>✅ 账户已授权 (EIP-7702)</strong>
                <p style={{ margin: '8px 0', fontSize: '13px' }}>
                  Delegation 合约: <code style={{ fontSize: '11px' }}>{capabilities.delegationAddress || delegationAddress}</code>
                </p>
                {upgradeCallId && (
                  <p style={{ margin: '8px 0', fontSize: '13px' }}>
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${upgradeCallId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#155724', textDecoration: 'underline' }}
                    >
                      查看最近升级交易详情 ↗
                    </a>
                  </p>
                )}
                <p style={{ margin: '8px 0', fontSize: '13px', color: '#666' }}>
                  您的账户已经是 Smart Account，可以直接使用批量交易功能。
                </p>
                
                <div className="button-group" style={{ marginTop: '16px' }}>
                  <button
                    onClick={() => setStep('transfer')}
                    className="primary-button"
                  >
                    下一步: 批量转账
                  </button>
                  <button 
                    onClick={handleRevoke}
                    className="danger-button"
                    style={{ 
                      background: '#fff', 
                      color: '#d32f2f', 
                      border: '1px solid #d32f2f',
                      marginLeft: '12px'
                    }}
                  >
                    撤销授权
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  将您的 EOA（外部账户）升级为 Smart Account（智能账户）
                </p>

                <div className="info-box">
                  <h4>升级说明：</h4>
                  <p style={{ margin: '8px 0', fontSize: '14px', lineHeight: '1.6' }}>
                    点击下方按钮后，MetaMask 会自动弹窗提示您升级到 Smart Account（EIP-7702）。
                    这是一次性操作，升级后您的 EOA 将获得以下功能：
                  </p>
                  <ul style={{ margin: '8px 0 8px 20px', fontSize: '13px', lineHeight: '1.6' }}>
                    <li>✅ <strong>批量交易</strong> - 一次确认，多笔交易原子执行</li>
                    <li>✅ <strong>Gasless 交易</strong> - 使用 Paymaster 代付 Gas 费用</li>
                    <li>✅ <strong>委托权限</strong> - 授权第三方代表您执行交易</li>
                    <li>✅ <strong>更多账户抽象功能</strong></li>
                  </ul>

                  <div style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    background: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '4px',
                    fontSize: '13px',
                    lineHeight: '1.6'
                  }}>
                    <strong>🔐 技术细节：</strong>
                    <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                      <li>升级通过发送一个 dummy batch call 触发</li>
                      <li>MetaMask 检测到您是 EOA 后会提示升级</li>
                      <li>您的账户将委托给 MetaMask EIP-7702 Delegator 合约</li>
                      <li>合约地址: <code style={{ fontSize: '11px' }}>0x63c0...e32b</code></li>
                    </ul>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#856404'
                  }}>
                    💡 <strong>注意：</strong>此操作需要支付少量 Gas 费用（大约 0.0001-0.001 ETH），除非启用 Gasless 模式。
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={enableGaslessUpgrade}
                        onChange={(e) => setEnableGaslessUpgrade(e.target.checked)}
                      />
                      <span style={{ marginLeft: '8px', fontWeight: 'bold', color: '#2e7d32' }}>
                        启用 Gasless 升级 (由 Relayer 代付 Gas)
                      </span>
                    </label>
                    {enableGaslessUpgrade && (
                      <small style={{ color: '#666', marginLeft: '24px' }}>
                        Relayer 将为您提交交易并支付 Gas 费用。您只需签署授权消息。
                      </small>
                    )}
                  </div>
                </div>

                {upgradeCallId && (
                  <div className="success-box">
                    <strong>✅ 升级完成！</strong>
                    <p style={{ margin: '8px 0', fontSize: '13px' }}>
                      Call ID: <code style={{ fontSize: '11px' }}>{upgradeCallId}</code>
                    </p>
                    <p style={{ margin: '8px 0', fontSize: '13px' }}>
                      <a 
                        href={`https://sepolia.etherscan.io/tx/${upgradeCallId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#155724', textDecoration: 'underline' }}
                      >
                        查看 Etherscan 交易详情 ↗
                      </a>
                    </p>
                    <p style={{ margin: '8px 0', fontSize: '13px' }}>
                      Delegation 合约: <code style={{ fontSize: '11px' }}>{delegationAddress}</code>
                    </p>
                    <p style={{ margin: '8px 0', fontSize: '13px', color: '#666' }}>
                      您的账户现在是 Smart Account，可以使用批量交易等高级功能！
                    </p>
                  </div>
                )}

                <div className="button-group">
                  <button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="primary-button"
                  >
                    {isLoading ? '升级中...' : '🔐 升级到 Smart Account'}
                  </button>
                  <button onClick={() => setStep('connect')} className="secondary-button" disabled={isLoading}>
                    返回
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 步骤 3: 批量转账 */}
        {step === 'transfer' && (
          <div className="step-section">
            <h3>步骤 3: EIP-5792 批量转账</h3>
            <p>
              使用 <code>sendCalls</code> API 执行批量交易
              {capabilities?.supportsAtomicBatch && ' (原子批量模式)'}
            </p>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  id="enablePaymaster"
                  checked={enablePaymaster}
                  onChange={(e) => setEnablePaymaster(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="enablePaymaster" style={{ marginBottom: 0 }}>启用 Paymaster (Gasless)</label>
              </div>
              
              {enablePaymaster && (
                <>
                  <input
                    type="text"
                    value={paymasterUrl}
                    onChange={(e) => setPaymasterUrl(e.target.value)}
                    placeholder="Paymaster Service URL"
                    className="input-field"
                  />
                  <small>输入支持 EIP-7677 的 Paymaster URL</small>
                </>
              )}
            </div>

            <div className="recipients-section">
              <h4>接收地址:</h4>

              {recipients.map((recipient, index) => (
                <div key={index} className="recipient-row">
                  <input
                    type="text"
                    value={recipient.address}
                    onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                    placeholder="接收地址 (0x...)"
                    className="input-field"
                  />
                  <input
                    type="text"
                    value={recipient.amount}
                    onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                    placeholder="金额 (ETH)"
                    className="input-field amount-input"
                  />
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(index)} className="remove-button">
                      删除
                    </button>
                  )}
                </div>
              ))}

              <button onClick={addRecipient} className="secondary-button">
                + 添加接收地址
              </button>
            </div>

            <div className="button-group">
              <button
                onClick={handleBatchTransfer}
                disabled={isLoading}
                className="primary-button"
              >
                {isLoading ? '执行中...' : '执行批量转账'}
              </button>
              <button onClick={() => setStep('connect')} className="secondary-button">
                返回
              </button>
            </div>

            {batchCallId && (
              <div className="success-box" style={{ marginTop: '20px' }}>
                <strong>🎉 批量转账成功！</strong>
                <p style={{ margin: '8px 0', fontSize: '13px' }}>
                  Call ID: <code style={{ fontSize: '11px' }}>{batchCallId}</code>
                </p>
                <p style={{ margin: '8px 0', fontSize: '13px' }}>
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${batchCallId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#155724', textDecoration: 'underline' }}
                  >
                    查看 Etherscan 交易详情 ↗
                  </a>
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div>账户: <code style={{ color: '#333' }}>{capabilities?.account?.slice(0, 6)}...{capabilities?.account?.slice(-4)}</code></div>
                <div style={{ marginTop: '4px' }}>
                  已授权: <a 
                    href={`https://sepolia.etherscan.io/address/${capabilities?.delegationAddress || delegationAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4a90e2', textDecoration: 'none' }}
                  >
                    {(capabilities?.delegationAddress || delegationAddress)?.slice(0, 6)}...{(capabilities?.delegationAddress || delegationAddress)?.slice(-4)} ↗
                  </a>
                </div>
              </div>
              <button 
                onClick={handleRevoke} 
                disabled={isLoading}
                className="danger-button"
                style={{ 
                  background: '#fff', 
                  color: '#d32f2f', 
                  border: '1px solid #d32f2f',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🚫 撤销授权 (恢复为 EOA)
              </button>
            </div>
          </div>
        )}

        {/* 重置按钮 */}
        {step !== 'connect' && (
          <div className="reset-section">
            <button onClick={handleReset} className="secondary-button">
              重置所有状态
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
