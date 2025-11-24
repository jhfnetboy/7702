import React, { useState } from 'react'
import { Header } from './components/Header'
import { EIP7702Demo } from './components/EIP7702Demo'
import { MetaMaskSmartAccount } from './components/MetaMaskSmartAccount'
import './App.css'

export default function App() {
  const [selectedTab, setSelectedTab] = useState<'demo' | 'metamask'>('demo')

  return (
    <div className="app">
      <Header />

      <nav className="app-nav">
        <button
          className={`nav-button ${selectedTab === 'demo' ? 'active' : ''}`}
          onClick={() => setSelectedTab('demo')}
        >
          EIP-7702 Demo
        </button>
        <button
          className={`nav-button ${selectedTab === 'metamask' ? 'active' : ''}`}
          onClick={() => setSelectedTab('metamask')}
        >
          MetaMask SDK
        </button>
      </nav>

      <main className="app-main">
        {selectedTab === 'demo' && (
          <div className="demo-content">
            <EIP7702Demo />
          </div>
        )}

        {selectedTab === 'metamask' && (
          <div className="metamask-content">
            <MetaMaskSmartAccount />
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
