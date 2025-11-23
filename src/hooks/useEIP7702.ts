import { useState, useCallback, useRef } from 'react'
import { encodeFunctionData, createWalletClient, custom, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { walletClient as relayWalletClient, publicClient as relayPublicClient } from '../config/viem'
import { createMetaMaskClient } from '../config/metamask'
import { delegationAbi, delegationContractAddress } from '../config/contract'
import { sepolia } from 'viem/chains'

interface EIP7702State {
  authorizationTx: string | null
  delegationTx: string | null
  pingTx: string | null
  loading: boolean
  error: string | null
  step: number
  smartAccountAddress: string | null
}

export const useEIP7702 = () => {
  const [state, setState] = useState<EIP7702State>({
    authorizationTx: null,
    delegationTx: null,
    pingTx: null,
    loading: false,
    error: null,
    step: 0,
    smartAccountAddress: null,
  })

  // Store the smart account client in a ref since it's not serializable
  const smartAccountClientRef = useRef<any>(null)

  /**
   * Connect to MetaMask Smart Account
   */
  const connectMetaMask = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      
      if (!window.ethereum) {
        throw new Error('MetaMask not found')
      }

      // Create clients using MetaMask provider
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum)
      })

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL)
      })

      // Request accounts to ensure connection
      const [address] = await walletClient.requestAddresses()
      
      // Create MetaMask Smart Account Client
      const client = await createMetaMaskClient(walletClient, publicClient)
      smartAccountClientRef.current = client

      console.log('Connected to MetaMask Smart Account:', client.account.address)
      
      setState((prev) => ({
        ...prev,
        smartAccountAddress: client.account.address,
        loading: false
      }))
      
      return client.account.address
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect MetaMask'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      console.error('MetaMask Connection Error:', err)
    }
    return null
  }, [])

  /**
   * Step 1: Create authorization for the contract delegation
   */
  const authorizeContract = useCallback(
    async (authorizerPrivateKey: `0x${string}`) => {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          step: 1,
        }))

        // Create account from private key (this is the account that will delegate)
        const eoa = privateKeyToAccount(authorizerPrivateKey)

        console.log('Step 1: Authorizing contract delegation')
        console.log('EOA Address:', eoa.address)
        console.log('Contract Address:', delegationContractAddress)

        // Sign authorization for contract delegation
        const authorization = await relayWalletClient.signAuthorization({
          account: eoa,
          contractAddress: delegationContractAddress,
        })

        console.log('Authorization signed:', authorization)

        return authorization
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to authorize'
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }))
        throw err
      }
    },
    []
  )

  /**
   * Step 1 (MetaMask): Create authorization using MetaMask
   */
  const authorizeWithMetaMask = useCallback(async (contractAddress: string) => {
    try {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        step: 1,
      }))

      console.log('Step 1 (MetaMask): Authorizing contract delegation')
      console.log('Contract Address:', contractAddress)

      if (!smartAccountClientRef.current) {
        throw new Error('Smart Account Client not initialized')
      }

      // The Kit likely handles the authorization signing internally when we try to send a UserOp
      // OR we might need to use a specific method if exposed.
      // However, since we want to sign an authorization for *our* contract, 
      // and the Kit enforces its own implementation, this might fail if we pass our contract address.
      // But let's try to see if the client exposes 'signAuthorization'.
      
      const client = smartAccountClientRef.current
      
      // Check if client has signAuthorization
      if (client.signAuthorization) {
         const authorization = await client.signAuthorization({
          account: client.account,
          contractAddress: contractAddress as `0x${string}`,
        })
        console.log('MetaMask Authorization signed:', authorization)
        return authorization
      } else {
        console.log('Client does not support signAuthorization directly. Attempting to use account object.')
        // Maybe the account object has it?
        if (client.account && client.account.signAuthorization) {
           const authorization = await client.account.signAuthorization({
            contractAddress: contractAddress as `0x${string}`,
          })
          console.log('MetaMask Authorization signed (via account):', authorization)
          return authorization
        }
        
        throw new Error('MetaMask Smart Account Client does not support signAuthorization')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to authorize with MetaMask'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      console.error('MetaMask Authorization Error:', err)
      throw err
    }
  }, [])

  /**
   * Step 2: Send transaction with authorization to initialize the contract
   */
  const initializeContract = useCallback(async (authorizerPrivateKey: `0x${string}`) => {
    try {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        step: 2,
      }))

      const eoa = privateKeyToAccount(authorizerPrivateKey)

      // Get authorization
      const authorization = await relayWalletClient.signAuthorization({
        account: eoa,
        contractAddress: delegationContractAddress,
      })

      console.log('Step 2: Sending initialization transaction')

      // Send transaction with authorization
      const hash = await relayWalletClient.sendTransaction({
        authorizationList: [authorization],
        data: encodeFunctionData({
          abi: delegationAbi,
          functionName: 'initialize',
        }),
        to: eoa.address,
      })

      console.log('Initialization tx hash:', hash)

      setState((prev) => ({
        ...prev,
        delegationTx: hash,
        step: 2,
      }))

      // Wait for transaction to be confirmed
      const receipt = await relayPublicClient.waitForTransactionReceipt({ hash })
      console.log('Initialization transaction confirmed:', receipt)

      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize contract'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw err
    } finally {
      setState((prev) => ({
        ...prev,
        loading: false,
      }))
    }
  }, [])

  /**
   * Step 3 & 4: Send transaction to ping the delegated contract
   */
  const pingContract = useCallback(async (authorizerAddress: string) => {
    try {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        step: 3,
      }))

      console.log('Step 3 & 4: Sending ping transaction')

      // After delegation, we can call ping without authorization
      const hash = await relayWalletClient.sendTransaction({
        data: encodeFunctionData({
          abi: delegationAbi,
          functionName: 'ping',
        }),
        to: authorizerAddress as `0x${string}`,
      })

      console.log('Ping tx hash:', hash)

      setState((prev) => ({
        ...prev,
        pingTx: hash,
        step: 3,
      }))

      // Wait for transaction to be confirmed
      const receipt = await relayPublicClient.waitForTransactionReceipt({ hash })
      console.log('Ping transaction confirmed:', receipt)

      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to ping contract'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
      throw err
    } finally {
      setState((prev) => ({
        ...prev,
        loading: false,
      }))
    }
  }, [])

  /**
   * Get transaction details from etherscan
   */
  const getTransactionLink = useCallback((txHash: string) => {
    return `https://sepolia.etherscan.io/tx/${txHash}`
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      authorizationTx: null,
      delegationTx: null,
      pingTx: null,
      loading: false,
      error: null,
      step: 0,
      smartAccountAddress: null,
    })
    smartAccountClientRef.current = null
  }, [])

  return {
    ...state,
    authorizeContract,
    authorizeWithMetaMask,
    connectMetaMask,
    initializeContract,
    pingContract,
    getTransactionLink,
    reset,
  }
}
