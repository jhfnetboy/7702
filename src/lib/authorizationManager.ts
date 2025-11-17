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
 * Sign an EIP-7702 authorization for an EOA
 *
 * This function allows an EOA (connected via MetaMask) to sign an authorization
 * that delegates execution to a contract. The transaction is executed and paid for
 * by a relay account.
 *
 * @param eoaAddress - The EOA address that will sign the authorization
 * @param delegationContract - The contract address to delegate to
 * @returns Transaction hash
 */
export async function signAuthorization(
  eoaAddress: Address,
  delegationContract: Address
): Promise<Hex> {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    if (!relayAccount) {
      throw new Error('Relay account not configured. Please set VITE_RELAY_PRIVATE_KEY in .env file');
    }

    // Create a wallet client for the EOA (via MetaMask)
    const eoaWalletClient = createWalletClient({
      chain: CHAIN_CONFIG.chain,
      transport: custom(window.ethereum)
    });

    // Step 1: EOA signs the authorization
    console.log('Step 1: Requesting authorization signature from EOA...');
    const authorization = await eoaWalletClient.signAuthorization({
      account: eoaAddress,
      contractAddress: delegationContract
    });

    console.log('Authorization signed:', authorization);

    // Step 2: Relay account submits the transaction with the authorization
    console.log('Step 2: Relay account submitting transaction...');
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
      // Optional: add data if you want to call a function immediately
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
 * Revoke an EIP-7702 authorization by setting the code to the zero address
 *
 * @param eoaAddress - The EOA address that wants to revoke authorization
 * @returns Transaction hash
 */
export async function revokeAuthorization(
  eoaAddress: Address
): Promise<Hex> {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    if (!relayAccount) {
      throw new Error('Relay account not configured. Please set VITE_RELAY_PRIVATE_KEY in .env file');
    }

    // The zero address - authorizing this effectively revokes the delegation
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

    // Create a wallet client for the EOA (via MetaMask)
    const eoaWalletClient = createWalletClient({
      chain: CHAIN_CONFIG.chain,
      transport: custom(window.ethereum)
    });

    // Step 1: EOA signs the authorization to zero address
    console.log('Step 1: Requesting revocation signature from EOA...');
    const authorization = await eoaWalletClient.signAuthorization({
      account: eoaAddress,
      contractAddress: ZERO_ADDRESS
    });

    console.log('Revocation signed:', authorization);

    // Step 2: Relay account submits the transaction
    console.log('Step 2: Relay account submitting revocation transaction...');
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
