import { useState, useCallback, useEffect } from 'react'

interface MetaMaskAccount {
  address: string | null
  balance: string | null
  isConnected: boolean
}

export const useMetaMask = () => {
  const [account, setAccount] = useState<MetaMaskAccount>({
    address: null,
    balance: null,
    isConnected: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && window.ethereum !== undefined
  }, [])

  // Connect to MetaMask
  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const accounts = (await window.ethereum!.request({
        method: 'eth_requestAccounts',
      })) as string[]

      const address = accounts[0]

      // Get balance
      const balance = (await window.ethereum!.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string

      setAccount({
        address,
        balance,
        isConnected: true,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect'
      setError(errorMessage)
      setAccount({
        address: null,
        balance: null,
        isConnected: false,
      })
    } finally {
      setLoading(false)
    }
  }, [isMetaMaskInstalled])

  // Disconnect
  const disconnect = useCallback(() => {
    setAccount({
      address: null,
      balance: null,
      isConnected: false,
    })
    setError(null)
  }, [])

  // Get balance for an address
  const getBalance = useCallback(async (address: string) => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed')
      return null
    }

    try {
      const balance = (await window.ethereum!.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string

      return balance
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get balance'
      setError(errorMessage)
      return null
    }
  }, [isMetaMaskInstalled])

  // Check if account is connected on mount
  useEffect(() => {
    if (isMetaMaskInstalled()) {
      const checkConnection = async () => {
        try {
          const accounts = (await window.ethereum!.request({
            method: 'eth_accounts',
          })) as string[]

          if (accounts && accounts.length > 0) {
            const address = accounts[0]
            const balance = (await window.ethereum!.request({
              method: 'eth_getBalance',
              params: [address, 'latest'],
            })) as string

            setAccount({
              address,
              balance,
              isConnected: true,
            })
          }
        } catch (err) {
          console.error('Failed to check connection:', err)
        }
      }

      checkConnection()

      // Listen for account changes
      const handleAccountsChanged = (accounts: any) => {
        if (accounts.length === 0) {
          disconnect()
        } else {
          const address = accounts[0]
          setAccount((prev) => ({
            ...prev,
            address,
          }))
        }
      }

      window.ethereum!.on('accountsChanged', handleAccountsChanged)

      return () => {
        window.ethereum!.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [isMetaMaskInstalled, disconnect])

  return {
    account,
    connect,
    disconnect,
    getBalance,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    loading,
    error,
  }
}
