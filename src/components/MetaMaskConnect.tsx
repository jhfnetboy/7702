import React from 'react'
import { useMetaMask } from '../hooks/useMetaMask'
import { formatEther } from 'viem'
import './MetaMaskConnect.css'

export const MetaMaskConnect: React.FC = () => {
  const { account, connect, disconnect, loading, error, isMetaMaskInstalled } = useMetaMask()

  const balanceInEth = account.balance ? parseFloat(formatEther(BigInt(account.balance))).toFixed(4) : '0'

  return (
    <div className="metamask-connect">
      <div className="metamask-header">
        <h2>MetaMask Connection</h2>
        <div className="status-indicator" style={{ backgroundColor: account.isConnected ? '#10b981' : '#ef4444' }}>
          {account.isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {!isMetaMaskInstalled && (
        <div className="warning">
          MetaMask is not installed. Please install MetaMask to use this application.
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {account.isConnected ? (
        <div className="account-info">
          <div className="info-item">
            <label>Address:</label>
            <code>{account.address}</code>
          </div>
          <div className="info-item">
            <label>ETH Balance:</label>
            <span className="balance">{balanceInEth} ETH</span>
          </div>
          <button onClick={disconnect} className="btn btn-danger">
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={loading || !isMetaMaskInstalled} className="btn btn-primary">
          {loading ? 'Connecting...' : 'Connect MetaMask'}
        </button>
      )}
    </div>
  )
}
