// Basic Delegation ABI
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
    stateMutability: 'nonpayable',
  },
] as const

// Mock ERC20 ABI
export const mockERC20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// Sponsored Transfer Delegation ABI
export const sponsoredTransferAbi = [
  {
    type: 'event',
    name: 'TransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BatchTransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: true },
    ],
  },
  {
    type: 'function',
    name: 'transferETH',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchTransfer',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBalance',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
] as const

// Sponsored Transfer Delegation V2 ABI (with ERC20 support)
export const sponsoredTransferV2Abi = [
  // ETH Transfer Events
  {
    type: 'event',
    name: 'TransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BatchTransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: true },
    ],
  },
  // ERC20 Transfer Events
  {
    type: 'event',
    name: 'ERC20TransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ERC20BatchTransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
      { name: 'gasPayer', type: 'address', indexed: false },
    ],
  },
  // ETH Functions
  {
    type: 'function',
    name: 'transferETH',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchTransfer',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBalance',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // ERC20 Functions
  {
    type: 'function',
    name: 'transferERC20',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchTransferERC20',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getERC20Balance',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMultipleBalances',
    inputs: [{ name: 'tokens', type: 'address[]' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenInfo',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { type: 'string', name: 'symbol' },
      { type: 'uint8', name: 'decimals' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
] as const

// Contract configurations
export const contracts = {
  delegation: {
    address: (import.meta.env.VITE_DELEGATION_CONTRACT_ADDRESS || '0x9381bbF662e415737FC33fecC71A660A6f642928') as `0x${string}`,
    abi: delegationAbi,
    name: 'Basic Delegation',
    description: '基础演示合约',
    features: ['Initialize', 'Ping'],
  },
  sponsoredTransfer: {
    address: (import.meta.env.VITE_SPONSORED_TRANSFER_CONTRACT_ADDRESS || '0x3bCC84C21BA32Dba8F3BE86F1E498778918e9B8F') as `0x${string}`,
    abi: sponsoredTransferAbi,
    name: 'Sponsored Transfer',
    description: '赞助转账合约 (可免 Gas)',
    features: ['Transfer ETH', 'Batch Transfer', 'Balance Query'],
  },
  sponsoredTransferV2: {
    address: (import.meta.env.VITE_SPONSORED_TRANSFER_V2_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: sponsoredTransferV2Abi,
    name: 'Sponsored Transfer V2',
    description: 'ETH + ERC20 转账合约 (支持代币批量转账)',
    features: ['ETH Transfer', 'ERC20 Transfer', 'Batch Transfer', 'Token Balance'],
  },
} as const

export type ContractType = keyof typeof contracts

// Token configurations
export const mockERC20Address = (import.meta.env.VITE_MOCK_ERC20_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

// Common test tokens on Sepolia (for quick selection)
export const commonTokens = {
  TUSDC: {
    address: mockERC20Address,
    symbol: 'TUSDC',
    name: 'Test USDC',
    decimals: 18,
  },
} as const

// Legacy exports for backward compatibility
export const delegationContractAddress = contracts.delegation.address
export const gTokenAddress = (import.meta.env.VITE_GTOKEN_CONTRACT_ADDRESS || '0x868F843723a98c6EECC4BF0aF3352C53d5004147') as `0x${string}`
