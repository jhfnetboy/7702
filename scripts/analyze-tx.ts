/**
 * Transaction Analysis Script
 * Analyze failed transactions using RPC calls
 */

import { createPublicClient, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'

const SEPOLIA_RPC_URL = process.env.VITE_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N'

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
})

async function analyzeTx(txHash: `0x${string}`) {
  console.log(`\n🔍 分析交易: ${txHash}\n`)

  try {
    // 1. Get transaction details
    console.log('📋 获取交易详情...')
    const tx = await publicClient.getTransaction({ hash: txHash })
    console.log('交易详情:', {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gas: tx.gas.toString(),
      gasPrice: tx.gasPrice?.toString(),
      nonce: tx.nonce,
      input: tx.input.substring(0, 66) + '...',
      type: tx.type,
    })

    // 2. Get transaction receipt
    console.log('\n📝 获取交易收据...')
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    console.log('交易收据:', {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      logs: receipt.logs.length,
    })

    // 3. Check transaction status
    if (receipt.status === 'success') {
      console.log('\n✅ 交易成功')
    } else {
      console.log('\n❌ 交易失败 (reverted)')

      // Try to get revert reason
      try {
        console.log('\n🔎 尝试获取revert原因...')
        await publicClient.call({
          to: tx.to!,
          data: tx.input,
          from: tx.from,
          value: tx.value,
        })
      } catch (error: any) {
        if (error.message) {
          console.log('Revert原因:', error.message)
        }
        if (error.data) {
          console.log('Revert数据:', error.data)
        }
      }
    }

    // 4. Decode input data if it's a contract call
    if (tx.input && tx.input !== '0x') {
      console.log('\n📊 Input数据分析:')
      console.log('完整Input:', tx.input)
      console.log('函数选择器:', tx.input.substring(0, 10))

      // Check if it's an EIP-7702 authorization transaction
      if (tx.type === 'eip7702' || tx.authorizationList) {
        console.log('\n🔐 EIP-7702 授权交易')
        console.log('Authorization List:', JSON.stringify(tx.authorizationList, null, 2))
      }
    }

    // 5. Get block info
    console.log('\n⛓️  区块信息...')
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
    console.log('区块信息:', {
      number: block.number.toString(),
      timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
    })

    // 6. Analyze logs
    if (receipt.logs.length > 0) {
      console.log('\n📜 事件日志:')
      receipt.logs.forEach((log, i) => {
        console.log(`\nLog ${i + 1}:`, {
          address: log.address,
          topics: log.topics,
          data: log.data.substring(0, 66) + '...',
        })
      })
    }

    // 7. Check if EOA code was changed (for EIP-7702)
    if (tx.to) {
      console.log('\n🔍 检查目标地址代码...')
      const code = await publicClient.getCode({ address: tx.to })
      if (code && code !== '0x') {
        console.log('地址代码:', code.substring(0, 50) + '...')

        // Check if it's EIP-7702 delegation code
        if (code.startsWith('0xef01')) {
          console.log('✅ 检测到 EIP-7702 委托代码')
          const delegationAddress = '0x' + code.substring(6, 46)
          console.log('委托目标合约:', delegationAddress)
        }
      } else {
        console.log('地址代码: 0x (EOA 或未授权)')
      }
    }

    return { tx, receipt }
  } catch (error: any) {
    console.error('\n❌ 分析失败:', error.message)
    throw error
  }
}

// Main execution
const txHash = process.argv[2] as `0x${string}`

if (!txHash || !txHash.startsWith('0x')) {
  console.error('❌ 请提供有效的交易哈希')
  console.error('用法: pnpm tsx scripts/analyze-tx.ts <tx-hash>')
  process.exit(1)
}

analyzeTx(txHash)
  .then(() => {
    console.log('\n✅ 分析完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 分析失败:', error)
    process.exit(1)
  })
