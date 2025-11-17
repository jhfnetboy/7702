import React, { useState } from 'react'
import { MetaMaskConnect } from './components/MetaMaskConnect'
import { EIP7702Demo } from './components/EIP7702Demo'
import './App.css'

export default function App() {
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'demo'>('demo')

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>EIP-7702 Demo Application</h1>
          <p>Gas-sponsored transactions using contract delegation</p>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-button ${selectedTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setSelectedTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`nav-button ${selectedTab === 'demo' ? 'active' : ''}`}
          onClick={() => setSelectedTab('demo')}
        >
          EIP-7702 Demo
        </button>
      </nav>

      <main className="app-main">
        {selectedTab === 'dashboard' && (
          <div className="dashboard-content">
            <MetaMaskConnect />
          </div>
        )}

        {selectedTab === 'demo' && (
          <div className="demo-content">
            <EIP7702Demo />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>EIP-7702 Demo • Built with Viem 2.39 • Sepolia Testnet</p>
          <div className="footer-links">
            <a href="https://viem.sh" target="_blank" rel="noopener noreferrer">
              Viem Docs
            </a>
            <a href="https://eips.ethereum.org/EIPS/eip-7702" target="_blank" rel="noopener noreferrer">
              EIP-7702
            </a>
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">
              Sepolia Etherscan
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
