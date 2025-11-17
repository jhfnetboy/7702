export const delegationAbi = [
  {
    type: 'event',
    name: 'Log',
    inputs: [
      {
        type: 'string',
        name: 'message',
        indexed: false,
      },
    ],
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'ping',
    inputs: [],
    outputs: [],
    stateMutability: 'pure',
  },
] as const

// This should be the deployed delegation contract address on Sepolia
// For now, we'll use a placeholder - you'll need to deploy the contract first
export const delegationContractAddress = (import.meta.env.VITE_DELEGATION_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const gTokenAddress = (import.meta.env.VITE_GTOKEN_CONTRACT_ADDRESS || '0x868F843723a98c6EECC4BF0aF3352C53d5004147') as `0x${string}`
