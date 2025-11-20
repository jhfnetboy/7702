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
import { parseEther, type Address } from 'viem'
import { useMetaMaskSmartAccount } from '../hooks/useMetaMaskSmartAccount'
import './MetaMaskSmartAccount.css'

export function MetaMaskSmartAccount() {
  const {
    permissions,
    isLoading,
    error,
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

  /**
   * 步骤 1: 连接钱包并检查能力
   */
  const handleConnect = async () => {
    try {
      // 检查 MetaMask 是否安装
      if (!window.ethereum) {
        alert('请安装 MetaMask!')
        return
      }

      // 请求连接
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      // 检查钱包能力
      const caps = await checkCapabilities()
      setCapabilities(caps)

      console.log('✅ Wallet capabilities:', caps)

      // 检查 EIP-5792 支持情况并提供升级指导
      if (!caps.supportsAtomicBatch) {
        const currentVersion = window.ethereum?.version || 'unknown'
        const upgradeMessage =
          `⚠️ MetaMask 版本过低\n\n` +
          `当前版本: ${currentVersion}\n` +
          `需要版本: v12.0 或更高\n\n` +
          `功能影响:\n` +
          `• 批量交易（EIP-5792）不可用\n` +
          `• 将回退到逐笔确认模式\n\n` +
          `如何升级:\n` +
          `1. 点击 MetaMask 图标 > 设置 > 关于\n` +
          `2. 或访问 https://metamask.io/download/\n` +
          `3. 下载最新版本并重新安装\n\n` +
          `您可以继续使用，但体验会受影响。`

        if (confirm(upgradeMessage + '\n\n是否在新标签页打开 MetaMask 下载页面？')) {
          window.open('https://metamask.io/download/', '_blank')
        }
      }

      setStep('permissions')
    } catch (err) {
      console.error('连接失败:', err)
      alert(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`)
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
      alert('✅ 权限已授予！现在可以执行 Gasless 批量转账')

      setStep('transfer')
    } catch (err) {
      console.error('权限请求失败:', err)
      alert(`权限请求失败: ${err instanceof Error ? err.message : '未知错误'}`)
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
        alert('请至少添加一个有效的接收地址')
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
      alert(`✅ 批量转账成功！Call ID: ${callId}`)
    } catch (err) {
      console.error('批量转账失败:', err)
      alert(`批量转账失败: ${err instanceof Error ? err.message : '未知错误'}`)
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

            <button onClick={handleConnect} disabled={isLoading} className="primary-button">
              {isLoading ? '连接中...' : '连接 MetaMask'}
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
                    MetaMask 版本: {window.ethereum?.version || 'unknown'}
                  </li>
                </ul>

                {/* 升级提示 */}
                {!capabilities.supportsAtomicBatch && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#fff3cd', borderRadius: '4px', fontSize: '14px' }}>
                    <strong>⚠️ 建议升级 MetaMask</strong>
                    <p style={{ margin: '8px 0', fontSize: '13px' }}>
                      当前版本不支持 EIP-5792 批量交易，将使用逐笔确认模式。
                    </p>
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0066cc', textDecoration: 'underline', fontSize: '13px' }}
                    >
                      下载 MetaMask v12+ →
                    </a>
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
              <input
                type="text"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value as Address)}
                placeholder="0x..."
                className="input-field"
              />
              <small>Dapp 后端生成的临时密钥地址</small>
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
