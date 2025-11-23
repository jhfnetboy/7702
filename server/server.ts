import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

// Load environment variables
dotenv.config()

const app = express()
const port = 3000

// Middleware
app.use(cors())
app.use(express.json())




// Relayer Account Setup
const PRIVATE_KEY = (process.env.PRIVATE_KEY || process.env.VITE_PRIVATE_KEY) as `0x${string}`
if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY or VITE_PRIVATE_KEY not found in .env')
  process.exit(1)
}

const account = privateKeyToAccount(PRIVATE_KEY)
const client = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.VITE_SEPOLIA_RPC_URL),
})

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.VITE_SEPOLIA_RPC_URL),
})

console.log(`🚀 Relayer Service started with account: ${account.address}`)

// Routes
app.get('/', (req, res) => {
  res.send('Relayer Service is running')
})

/**
 * POST /upgrade
 * Submits an EIP-7702 authorization transaction paid by the Relayer.
 */
app.post('/upgrade', async (req, res) => {
  try {
    const { authorization } = req.body

    if (!authorization) {
      return res.status(400).json({ error: 'Missing authorization data' })
    }

    console.log('📝 Received upgrade request for:', authorization.contractAddress)
    console.log('   Authorization:', authorization)

    // Construct the transaction
    // The Relayer sends a transaction to the user's account (or any address)
    // including the authorization list.
    // To be safe and standard, we can send 0 ETH to the user's account.
    const hash = await client.sendTransaction({
      to: authorization.contractAddress, // Send to the user's account (which is being upgraded)
      value: 0n,
      authorizationList: [authorization],
    })

    console.log('✅ Transaction sent:', hash)

    // Wait for receipt (optional, but good for immediate feedback)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber)

    res.json({ success: true, hash, blockNumber: receipt.blockNumber.toString() })
  } catch (error) {
    console.error('❌ Upgrade failed:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Start server
app.listen(port, () => {
  console.log(`⚡️ Server listening at http://localhost:${port}`)
})
