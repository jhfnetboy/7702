import { createWalletClient, createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N'

// Relay account - pays for the transaction
const relayPrivateKey = import.meta.env.VITE_RELAY_PRIVATE_KEY as `0x${string}`
if (!relayPrivateKey) {
  throw new Error('VITE_RELAY_PRIVATE_KEY is not set in environment variables')
}
const relay = privateKeyToAccount(relayPrivateKey)

// Public client for reading
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

// Wallet client for sending transactions (relay account)
export const walletClient = createWalletClient({
  account: relay,
  chain: sepolia,
  transport: http(rpcUrl),
})

export { relay }
export const RPC_URL = rpcUrl
