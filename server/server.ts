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
    const { authorization, account } = req.body

    if (!authorization || !account) {
      return res.status(400).json({ error: 'Missing authorization or account data' })
    }

    console.log('📝 Received upgrade request')
    console.log('   User Account:', account)
    console.log('   Delegator Contract:', authorization.address)
    console.log('   Authorization Nonce:', authorization.nonce)

    // Import getAddress for checksum validation
    const { getAddress } = await import('viem')
    
    // Ensure addresses are properly checksummed
    const userAccount = getAddress(account)
    const delegatorAddress = getAddress(authorization.address)

    // CRITICAL: Verify nonce matches current account nonce
    // Convert both to Number to avoid BigInt comparison issues
    const currentNonce = await publicClient.getTransactionCount({ address: userAccount })
    const currentNonceNum = Number(currentNonce)
    const authNonceNum = Number(authorization.nonce)
    
    console.log('   Current Account Nonce:', currentNonceNum, '(original:', currentNonce, typeof currentNonce, ')')
    console.log('   Authorization Nonce:', authNonceNum, '(original:', authorization.nonce, typeof authorization.nonce, ')')
    
    if (authNonceNum !== currentNonceNum) {
      console.error('❌ Nonce mismatch!')
      console.error(`   Authorization nonce: ${authNonceNum}`)
      console.error(`   Current nonce: ${currentNonceNum}`)
      return res.status(400).json({ 
        error: 'Nonce mismatch: Authorization is stale. ' +
               `Expected nonce ${currentNonceNum}, but authorization has nonce ${authNonceNum}. ` +
               'Please sign a new authorization with the current nonce.'
      })
    }
    
    console.log('✅ Nonce verification passed')

    // Construct the transaction
    // Send to user's account with authorization list
    const hash = await client.sendTransaction({
      to: userAccount, // Send to the USER's account being upgraded
      value: 0n,
      authorizationList: [{
        chainId: authorization.chainId,
        address: delegatorAddress,
        nonce: BigInt(authorization.nonce),
        r: authorization.r,
        s: authorization.s,
        v: authorization.v
      }],
    })

    console.log('✅ Transaction sent:', hash)

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber)

    res.json({ success: true, hash, blockNumber: receipt.blockNumber.toString() })
  } catch (error) {
    console.error('❌ Upgrade failed:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

/**
 * POST /revoke
 * Submits an EIP-7702 revocation transaction paid by the Relayer.
 */
app.post('/revoke', async (req, res) => {
  try {
    const { authorization, account: userAccount } = req.body

    if (!authorization || !userAccount) {
      return res.status(400).json({ error: 'Missing authorization or account data' })
    }

    console.log('🚫 Received revoke request for:', userAccount)
    console.log('   Authorization:', authorization)

    // Construct the transaction to revoke (delegate to zero address)
    const hash = await client.sendTransaction({
      to: userAccount, // Send to user's account
      value: 0n,
      authorizationList: [authorization],
    })

    console.log('✅ Revoke transaction sent:', hash)

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('✅ Revoke confirmed in block:', receipt.blockNumber)

    res.json({ success: true, hash, blockNumber: receipt.blockNumber.toString() })
  } catch (error) {
    console.error('❌ Revoke failed:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Start server
app.listen(port, () => {
  console.log(`⚡️ Server listening at http://localhost:${port}`)
})
