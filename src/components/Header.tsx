import React from 'react'
import { useMetaMask } from '../hooks/useMetaMask'
import { formatEther } from 'viem'
import './Header.css'

export const Header: React.FC = () => {
  const { account, connect, disconnect, loading, isMetaMaskInstalled } = useMetaMask()

  const balanceInEth = account.balance ? parseFloat(formatEther(BigInt(account.balance))).toFixed(4) : '0'
  const shortAddress = account.address 
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` 
    : ''

  return (
    <header className="app-header-bar">
      <div className="header-left">
        <h1>EIP-7702 Demo</h1>
      </div>
      
      <div className="header-right">
        {!isMetaMaskInstalled ? (
          <div className="warning-badge">MetaMask Required</div>
        ) : account.isConnected ? (
          <div className="wallet-info">
            <span className="balance">{balanceInEth} ETH</span>
            <span className="address" title={account.address || undefined}>{shortAddress}</span>
            <button onClick={disconnect} className="btn-disconnect">
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={connect} 
            disabled={loading} 
            className="btn-connect"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </header>
  )
}
