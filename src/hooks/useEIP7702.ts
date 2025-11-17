import { useState, useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { walletClient, publicClient } from '../config/viem'
import { delegationAbi, delegationContractAddress } from '../config/contract'

interface EIP7702State {
  authorizationTx: string | null
  delegationTx: string | null
  pingTx: string | null
  loading: boolean
  error: string | null
  step: number
}

interface EIP7702Result {
  authorizationTx?: string
  delegationTx?: string
  pingTx?: string
}

export const useEIP7702 = () => {
  const [state, setState] = useState<EIP7702State>({
    authorizationTx: null,
    delegationTx: null,
    pingTx: null,
    loading: false,
    error: null,
    step: 0,
  })

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
        const authorization = await walletClient.signAuthorization({
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
      const authorization = await walletClient.signAuthorization({
        account: eoa,
        contractAddress: delegationContractAddress,
      })

      console.log('Step 2: Sending initialization transaction')

      // Send transaction with authorization
      const hash = await walletClient.sendTransaction({
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
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
      const hash = await walletClient.sendTransaction({
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
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
    })
  }, [])

  return {
    ...state,
    authorizeContract,
    initializeContract,
    pingContract,
    getTransactionLink,
    reset,
  }
}
