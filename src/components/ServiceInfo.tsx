import React, { useState, useEffect } from 'react'
import { createPublicClient, http, formatEther, type Address } from 'viem'
import { sepolia } from 'viem/chains'

// ERC-4337 EntryPoint address (Sepolia)
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address

interface ServiceInfoProps {
  relayAddress?: string
  paymasterAddress?: string
  showPaymaster: boolean
}

export function ServiceInfo({ relayAddress, paymasterAddress, showPaymaster }: ServiceInfoProps) {
  const [relayBalance, setRelayBalance] = useState<string>('--')
  const [paymasterBalance, setPaymasterBalance] = useState<string>('--')
  const [paymasterDeposit, setPaymasterDeposit] = useState<string>('--')
  const [isLoading, setIsLoading] = useState(false)

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!relayAddress && (!showPaymaster || !paymasterAddress)) return

      setIsLoading(true)
      try {
        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
        })

        // Fetch Relay balance
        if (relayAddress) {
          const balance = await publicClient.getBalance({ address: relayAddress as Address })
          setRelayBalance(parseFloat(formatEther(balance)).toFixed(4))
        }

        // Fetch Paymaster balance and deposit
        if (showPaymaster && paymasterAddress) {
          // ETH balance
          const pmBalance = await publicClient.getBalance({ address: paymasterAddress as Address })
          setPaymasterBalance(parseFloat(formatEther(pmBalance)).toFixed(4))

          // EntryPoint deposit
          try {
            const deposit = await publicClient.readContract({
              address: ENTRYPOINT_ADDRESS,
              abi: [{
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }]
              }],
              functionName: 'balanceOf',
              args: [paymasterAddress as Address]
            })
            setPaymasterDeposit(parseFloat(formatEther(deposit as bigint)).toFixed(4))
          } catch (err) {
            console.error('Failed to fetch EntryPoint deposit:', err)
            setPaymasterDeposit('N/A')
          }
        }
      } catch (error) {
        console.error('Failed to fetch balances:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalances()
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalances, 10000)
    return () => clearInterval(interval)
  }, [relayAddress, paymasterAddress, showPaymaster])

  return (
    <div style={{
      marginTop: '24px',
      padding: '16px',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: '#495057' }}>
        ⚙️ Service Status
      </h3>

      {/* Relay Info */}
      <div style={{
        marginBottom: showPaymaster ? '16px' : '0',
        padding: '12px',
        background: 'white',
        borderRadius: '6px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#212529' }}>
            🔄 Relay Server
          </span>
          <span style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            background: '#d1ecf1',
            color: '#0c5460',
            fontSize: '11px',
            borderRadius: '12px',
            fontWeight: '500'
          }}>
            Default
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
          <code style={{
            background: '#f1f3f5',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px'
          }}>
            {relayAddress || 'Not configured'}
          </code>
        </div>
        <div style={{ fontSize: '13px', color: '#495057', fontWeight: '500' }}>
          余额: {isLoading ? '⏳' : `${relayBalance} ETH`}
        </div>
      </div>

      {/* Paymaster Info (when enabled) */}
      {showPaymaster && (
        <div style={{
          padding: '12px',
          background: 'white',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#212529' }}>
              💎 Paymaster Contract
            </span>
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              background: paymasterAddress ? '#d4edda' : '#f8d7da',
              color: paymasterAddress ? '#155724' : '#721c24',
              fontSize: '11px',
              borderRadius: '12px',
              fontWeight: '500'
            }}>
              {paymasterAddress ? 'Active' : 'Not Deployed'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px' }}>
            <code style={{
              background: '#f1f3f5',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px'
            }}>
              {paymasterAddress || '0x0000...0000 (需要部署)'}
            </code>
          </div>
          {paymasterAddress && (
            <>
              <div style={{ fontSize: '13px', color: '#495057', marginBottom: '4px' }}>
                💰 ETH 余额: {isLoading ? '⏳' : `${paymasterBalance} ETH`}
              </div>
              <div style={{ fontSize: '13px', color: '#495057' }}>
                🏦 EntryPoint 存款: {isLoading ? '⏳' : `${paymasterDeposit} ETH`}
              </div>
              <div style={{ 
                marginTop: '8px', 
                fontSize: '11px', 
                color: '#6c757d',
                padding: '6px 8px',
                background: '#f8f9fa',
                borderRadius: '4px'
              }}>
                ℹ️ EntryPoint: {ENTRYPOINT_ADDRESS.slice(0, 6)}...{ENTRYPOINT_ADDRESS.slice(-4)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
