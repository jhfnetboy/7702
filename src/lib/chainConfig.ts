import { writable } from 'svelte/store';
import { sepolia, type Chain } from 'viem/chains';

// Get Alchemy API key from environment variable
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  throw new Error('Missing Alchemy API key in environment variables');
}

export type ChainConfig = {
  chain: Chain;
  rpcUrl: string;
  batchCallDelegationAddress: `0x${string}`;
};

// Chain configurations (Sepolia testnet only)
export const chainConfigs = {
  sepolia: {
    chain: sepolia,
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    batchCallDelegationAddress: '0x6987E30398b2896B5118ad1076fb9f58825a6f1a'
  }
} as const;

// Create a store for the current chain configuration (Sepolia)
export const currentChainConfig = writable<ChainConfig>(chainConfigs.sepolia);

// Get the current network name
export function getCurrentNetwork(): string {
  return 'sepolia';
} 