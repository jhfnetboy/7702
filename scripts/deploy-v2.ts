import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const RELAY_PRIVATE_KEY = process.env.VITE_RELAY_PRIVATE_KEY || ''
const RPC_URL = process.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'

if (!RELAY_PRIVATE_KEY) {
  console.error('❌ VITE_RELAY_PRIVATE_KEY not found in .env')
  process.exit(1)
}

const account = privateKeyToAccount(RELAY_PRIVATE_KEY as `0x${string}`)

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
})

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
})

async function deployMockERC20() {
  console.log('📝 Deploying MockERC20...')

  // Read and compile MockERC20
  const mockERC20Source = fs.readFileSync(
    path.join(__dirname, '../contracts/MockERC20.sol'),
    'utf-8'
  )

  // Bytecode for MockERC20 (you'll need to compile this with solc)
  // For now, I'll use a deployment transaction
  const constructorArgs = {
    name: 'Test USDC',
    symbol: 'TUSDC',
    initialSupply: '1000000', // 1 million tokens
  }

  console.log('Constructor args:', constructorArgs)
  console.log('⚠️  Note: You need to compile the contract first using:')
  console.log('   forge build  OR  solc contracts/MockERC20.sol')
  console.log('')
  console.log('For now, manually deploy using:')
  console.log('1. Go to https://remix.ethereum.org')
  console.log('2. Paste MockERC20.sol content')
  console.log('3. Compile with Solidity 0.8.20')
  console.log('4. Deploy to Sepolia with params:', JSON.stringify(constructorArgs))
  console.log('')

  // Return placeholder address (user will update after manual deployment)
  return '0x0000000000000000000000000000000000000000'
}

async function deploySponsoredTransferV2() {
  console.log('📝 Deploying SponsoredTransferDelegationV2...')

  console.log('⚠️  Note: You need to compile the contract first using:')
  console.log('   forge build  OR  solc contracts/SponsoredTransferDelegationV2.sol')
  console.log('')
  console.log('For now, manually deploy using:')
  console.log('1. Go to https://remix.ethereum.org')
  console.log('2. Paste SponsoredTransferDelegationV2.sol content')
  console.log('3. Compile with Solidity 0.8.20')
  console.log('4. Deploy to Sepolia (no constructor params needed)')
  console.log('')

  // Return placeholder address (user will update after manual deployment)
  return '0x0000000000000000000000000000000000000000'
}

async function main() {
  console.log('🚀 Deployment Script for V2 Contracts\n')
  console.log('Deployer:', account.address)
  console.log('Network: Sepolia\n')

  const balance = await publicClient.getBalance({ address: account.address })
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH\n')

  if (balance < parseEther('0.01')) {
    console.error('❌ Insufficient balance. Need at least 0.01 ETH for deployment.')
    console.log('Get Sepolia ETH from: https://sepoliafaucet.com')
    process.exit(1)
  }

  // Step 1: Deploy MockERC20
  const mockERC20Address = await deployMockERC20()

  // Step 2: Deploy SponsoredTransferDelegationV2
  const v2Address = await deploySponsoredTransferV2()

  console.log('\n✅ Deployment Guide Complete!\n')
  console.log('After manual deployment, update your .env file:')
  console.log(`VITE_MOCK_ERC20_ADDRESS=${mockERC20Address}`)
  console.log(`VITE_SPONSORED_TRANSFER_V2_ADDRESS=${v2Address}`)
}

main().catch(console.error)
