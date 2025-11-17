/**
 * EIP-7702 Authorization Manager
 *
 * This module provides utilities for managing EIP-7702 authorizations,
 * allowing EOAs (Externally Owned Accounts) to delegate contract code execution.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type Address,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Get configuration from environment variables
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const RELAY_PRIVATE_KEY = import.meta.env.VITE_RELAY_PRIVATE_KEY as Hex;

if (!ALCHEMY_API_KEY) {
  throw new Error('Missing VITE_ALCHEMY_API_KEY in environment variables');
}

if (!RELAY_PRIVATE_KEY || RELAY_PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
  console.warn('Warning: VITE_RELAY_PRIVATE_KEY not properly configured. Authorization signing will not work.');
}

// Chain configuration
const CHAIN_CONFIG = {
  chain: sepolia,
  rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  // Default delegation contract (BatchCallDelegation)
  defaultDelegationContract: '0x6987E30398b2896B5118ad1076fb9f58825a6f1a' as Address
};

// Create public client for reading blockchain state
export const publicClient = createPublicClient({
  chain: CHAIN_CONFIG.chain,
  transport: http(CHAIN_CONFIG.rpcUrl)
});

// Create relay account for paying gas fees
const relayAccount = RELAY_PRIVATE_KEY && RELAY_PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000'
  ? privateKeyToAccount(RELAY_PRIVATE_KEY)
  : null;

/**
 * Authorization status result
 */
export interface AuthorizationStatus {
  isAuthorized: boolean;
  delegatedContract: Address | null;
  code: Hex | null;
}

/**
 * Check if an EOA has an active EIP-7702 authorization
 *
 * @param eoaAddress - The address of the EOA to check
 * @returns Authorization status information
 */
export async function checkAuthorizationStatus(
  eoaAddress: Address
): Promise<AuthorizationStatus> {
  try {
    // Get the code at the EOA address
    const code = await publicClient.getCode({
      address: eoaAddress
    });

    // If code is empty ('0x' or null), the account is not authorized
    if (!code || code === '0x') {
      return {
        isAuthorized: false,
        delegatedContract: null,
        code: null
      };
    }

    // For EIP-7702, the code is typically in the format:
    // 0xef0100 + <20-byte address>
    // Extract the delegated contract address
    let delegatedContract: Address | null = null;

    if (code.startsWith('0xef0100') && code.length >= 46) {
      // Extract the 20-byte address (40 hex chars) after the 0xef0100 prefix (6 chars)
      const addressHex = code.slice(6, 46);
      delegatedContract = `0x${addressHex}` as Address;
    }

    return {
      isAuthorized: true,
      delegatedContract,
      code
    };
  } catch (error) {
    console.error('Error checking authorization status:', error);
    throw error;
  }
}

/**
 * Sign an EIP-7702 authorization using MetaMask (EIP-712)
 *
 * This function uses MetaMask to sign an EIP-7702 authorization via EIP-712 typed data.
 * The signed authorization is then sent by the relay account to pay gas fees.
 *
 * @param eoaAddress - The EOA address (from MetaMask)
 * @param delegationContract - The contract address to delegate to
 * @returns Transaction hash
 */
export async function signAuthorizationWithMetaMask(
  eoaAddress: Address,
  delegationContract: Address
): Promise<Hex> {
  try {
    if (!relayAccount) {
      throw new Error('Relay account not configured. Please set VITE_RELAY_PRIVATE_KEY in .env file');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    console.log('Step 1: Getting nonce for EOA...');
    // Get the nonce for the EOA
    const nonce = await publicClient.getTransactionCount({
      address: eoaAddress
    });

    console.log('Step 2: Creating EIP-712 typed data for authorization...');
    // EIP-7702 Authorization EIP-712 domain and types
    const domain = {
      name: 'EIP-7702',
      version: '1',
      chainId: CHAIN_CONFIG.chain.id
    };

    const types = {
      Authorization: [
        { name: 'chainId', type: 'uint256' },
        { name: 'address', type: 'address' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const message = {
      chainId: CHAIN_CONFIG.chain.id,
      address: delegationContract,
      nonce: BigInt(nonce)
    };

    console.log('Step 3: Requesting signature from MetaMask...');
    // Request signature from MetaMask using EIP-712
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [
        eoaAddress,
        JSON.stringify({
          domain,
          types,
          primaryType: 'Authorization',
          message
        })
      ]
    }) as Hex;

    console.log('Authorization signed:', signature);

    // Parse signature into r, s, v components
    const r = `0x${signature.slice(2, 66)}` as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    // Construct authorization object for transaction
    const authorization = {
      chainId: CHAIN_CONFIG.chain.id,
      address: delegationContract,
      nonce: BigInt(nonce),
      r,
      s,
      yParity: v === 27 ? 0 : 1
    };

    console.log('Step 4: Relay account submitting transaction...');
    const relayWalletClient = createWalletClient({
      account: relayAccount,
      chain: CHAIN_CONFIG.chain,
      transport: http(CHAIN_CONFIG.rpcUrl)
    });

    // Send a transaction that includes the authorization
    // This transaction will set the code on the EOA
    const hash = await relayWalletClient.sendTransaction({
      to: eoaAddress,
      value: 0n,
      authorizationList: [authorization],
      data: '0x' as Hex
    });

    console.log('Authorization transaction submitted:', hash);
    return hash;
  } catch (error) {
    console.error('Error signing authorization:', error);
    throw error;
  }
}

/**
 * Revoke an EIP-7702 authorization using MetaMask (EIP-712)
 *
 * This function uses MetaMask to sign a revocation by authorizing the zero address.
 * The relay account pays the gas fees.
 *
 * @param eoaAddress - The EOA address (from MetaMask)
 * @returns Transaction hash
 */
export async function revokeAuthorizationWithMetaMask(
  eoaAddress: Address
): Promise<Hex> {
  try {
    if (!relayAccount) {
      throw new Error('Relay account not configured. Please set VITE_RELAY_PRIVATE_KEY in .env file');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // The zero address - authorizing this effectively revokes the delegation
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

    console.log('Step 1: Getting nonce for EOA...');
    // Get the nonce for the EOA
    const nonce = await publicClient.getTransactionCount({
      address: eoaAddress
    });

    console.log('Step 2: Creating EIP-712 typed data for revocation...');
    // EIP-7702 Authorization EIP-712 domain and types
    const domain = {
      name: 'EIP-7702',
      version: '1',
      chainId: CHAIN_CONFIG.chain.id
    };

    const types = {
      Authorization: [
        { name: 'chainId', type: 'uint256' },
        { name: 'address', type: 'address' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const message = {
      chainId: CHAIN_CONFIG.chain.id,
      address: ZERO_ADDRESS,
      nonce: BigInt(nonce)
    };

    console.log('Step 3: Requesting signature from MetaMask...');
    // Request signature from MetaMask using EIP-712
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [
        eoaAddress,
        JSON.stringify({
          domain,
          types,
          primaryType: 'Authorization',
          message
        })
      ]
    }) as Hex;

    console.log('Revocation signed:', signature);

    // Parse signature into r, s, v components
    const r = `0x${signature.slice(2, 66)}` as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    // Construct authorization object for transaction
    const authorization = {
      chainId: CHAIN_CONFIG.chain.id,
      address: ZERO_ADDRESS,
      nonce: BigInt(nonce),
      r,
      s,
      yParity: v === 27 ? 0 : 1
    };

    console.log('Step 4: Relay account submitting revocation transaction...');
    const relayWalletClient = createWalletClient({
      account: relayAccount,
      chain: CHAIN_CONFIG.chain,
      transport: http(CHAIN_CONFIG.rpcUrl)
    });

    const hash = await relayWalletClient.sendTransaction({
      to: eoaAddress,
      value: 0n,
      authorizationList: [authorization],
      data: '0x' as Hex
    });

    console.log('Revocation transaction submitted:', hash);
    return hash;
  } catch (error) {
    console.error('Error revoking authorization:', error);
    throw error;
  }
}

/**
 * Get the default delegation contract address
 */
export function getDefaultDelegationContract(): Address {
  return CHAIN_CONFIG.defaultDelegationContract;
}

/**
 * Get the block explorer URL for a transaction
 */
export function getTransactionUrl(hash: Hex): string {
  return `${CHAIN_CONFIG.chain.blockExplorers?.default.url}/tx/${hash}`;
}

/**
 * Get the block explorer URL for an address
 */
export function getAddressUrl(address: Address): string {
  return `${CHAIN_CONFIG.chain.blockExplorers?.default.url}/address/${address}`;
}

/**
 * Format an address for display (shortened)
 */
export function formatAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
