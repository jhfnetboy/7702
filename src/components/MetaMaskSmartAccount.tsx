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
    requestPermissions,
    batchTransfer,
    reset,
  } = useMetaMaskSmartAccount()

  // UI 状态
  const [step, setStep] = useState<'connect' | 'permissions' | 'transfer'>('connect')
  const [capabilities, setCapabilities] = useState<any>(null)
  const [sessionKey, setSessionKey] = useState<Address>('0x0000000000000000000000000000000000000000')
  const [recipients, setRecipients] = useState<Array<{ address: string; amount: string }>>([
    { address: '', amount: '' },
  ])
  const [maxAmount, setMaxAmount] = useState('1')
  const [paymasterUrl, setPaymasterUrl] = useState('http://localhost:3001/api/sponsor')
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(false)

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

      setStep('permissions')
    } catch (err) {
      console.error('❌ 连接失败:', err)
      // 错误已通过 hook 的 error state 显示，无需 alert
    }
  }

  /**
   * 步骤 2: 请求权限
   *
   * 关键！这会触发 MetaMask:
   * 1. 检测用户是 EOA
   * 2. 弹出"切换到 Smart Account"
   * 3. 自动完成 EIP-7702 升级
   * 4. 显示权限规则
   * 5. 用户签署 Delegation
   */
  const handleRequestPermissions = async () => {
    try {
      console.log('📝 Requesting permissions...')

      const perms = await requestPermissions({
        sessionKey,
        maxAmount: parseEther(maxAmount),
        periodDuration: 86400, // 24 小时
        expiry: 86400, // 24 小时过期
      })

      console.log('✅ Permissions granted:', perms)
      // 成功后自动进入下一步，无需 alert

      setStep('transfer')
    } catch (err) {
      console.error('❌ 权限请求失败:', err)
      // 错误已通过 hook 的 error state 显示，无需 alert
    }
  }

  /**
   * 步骤 3: 执行 Gasless 批量转账
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
        paymasterUrl: paymasterUrl || undefined,
      })

      console.log('✅ Batch transfer completed, call ID:', callId)
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
                      {window.ethereum?.version && parseFloat(window.ethereum.version) >= 12
                        ? `检测到 MetaMask ${window.ethereum.version}（最新版本），但 EIP-5792 能力未检测到。这可能是：`
                        : '当前 MetaMask 版本不支持 EIP-5792 批量交易。'}
                    </p>
                    {window.ethereum?.version && parseFloat(window.ethereum.version) >= 12 ? (
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

        {/* 步骤 2: 请求权限 */}
        {step === 'permissions' && (
          <div className="step-section">
            <h3>步骤 2: 请求执行权限</h3>
            <p>
              请求权限会触发 MetaMask 自动将您的 EOA 升级为 Smart Account（EIP-7702）
            </p>

            <div className="form-group">
              <label>Session Key 地址:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={sessionKey}
                  onChange={(e) => setSessionKey(e.target.value as Address)}
                  placeholder="0x..."
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => {
                    // 生成一个随机的临时地址（仅用于测试）
                    const randomKey = `0x${Array.from({ length: 40 }, () =>
                      Math.floor(Math.random() * 16).toString(16)
                    ).join('')}` as Address
                    setSessionKey(randomKey)
                    console.log('🔑 Generated temporary Session Key:', randomKey)
                  }}
                  className="secondary-button"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  生成测试密钥
                </button>
              </div>
              <small>
                💡 测试时点击"生成测试密钥"按钮。生产环境中应由后端生成真实密钥对。
              </small>
            </div>

            <div className="form-group">
              <label>最大金额（ETH，每日限额）:</label>
              <input
                type="text"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="1.0"
                className="input-field"
              />
            </div>

            <div className="button-group">
              <button
                onClick={handleRequestPermissions}
                disabled={isLoading || !sessionKey}
                className="primary-button"
              >
                {isLoading ? '请求中...' : '请求权限（触发 EIP-7702 升级）'}
              </button>
              <button onClick={() => setStep('connect')} className="secondary-button">
                返回
              </button>
            </div>

            {permissions && (
              <div className="success-box">
                <strong>✅ 权限已授予!</strong>
                <pre>{JSON.stringify(permissions, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* 步骤 3: 批量转账 */}
        {step === 'transfer' && (
          <div className="step-section">
            <h3>步骤 3: Gasless 批量转账</h3>
            <p>使用 EIP-5792 执行批量交易，Paymaster 代付 Gas</p>

            <div className="form-group">
              <label>Paymaster 服务 URL (可选):</label>
              <input
                type="text"
                value={paymasterUrl}
                onChange={(e) => setPaymasterUrl(e.target.value)}
                placeholder="http://localhost:3001/api/sponsor"
                className="input-field"
              />
              <small>留空则用户自己支付 Gas</small>
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
                {isLoading ? '执行中...' : '执行 Gasless 批量转账'}
              </button>
              <button onClick={() => setStep('permissions')} className="secondary-button">
                返回
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
