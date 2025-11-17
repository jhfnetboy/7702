/**
 * EIP-7702 Authorization Manager (Refactored for Private Key Accounts)
 *
 * This module provides utilities for managing EIP-7702 authorizations using private key accounts
 * for both the authorizer and the relayer.
 */

import {
	createPublicClient,
	createWalletClient,
	http,
	type Address,
	type Hex,
	type PrivateKeyAccount
} from 'viem';
import { sepolia } from 'viem/chains';

// Get configuration from environment variables
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
	throw new Error('Missing VITE_ALCHEMY_API_KEY in environment variables');
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

/**
 * Signs an EIP-7702 authorization using an authorizer's private key and sends
 * the transaction using a relayer's private key.
 *
 * @param authorizerAccount - The Viem account object for the EOA that will sign the authorization.
 * @param relayerAccount - The Viem account object for the EOA that will pay the gas fee.
 * @param delegationContract - The contract address to delegate to.
 * @returns Transaction hash.
 */
export async function signAuthorizationForRelayer(
	authorizerAccount: PrivateKeyAccount,
	relayerAccount: PrivateKeyAccount,
	delegationContract: Address
): Promise<Hex> {
	try {
		// Create a wallet client for the authorizer to sign the message
		const authorizerWalletClient = createWalletClient({
			account: authorizerAccount,
			chain: CHAIN_CONFIG.chain,
			transport: http(CHAIN_CONFIG.rpcUrl)
		});

		// Step 1: Authorizer signs the authorization
		console.log('Step 1: Signing authorization with Authorizer account...');
		const authorization = await authorizerWalletClient.signAuthorization({
			contractAddress: delegationContract
		});
		console.log('Authorization signed:', authorization);

		// Create a wallet client for the relayer to send the transaction
		const relayWalletClient = createWalletClient({
			account: relayerAccount,
			chain: CHAIN_CONFIG.chain,
			transport: http(CHAIN_CONFIG.rpcUrl)
		});

		// Step 2: Relay account submits the transaction with the authorization
		console.log('Step 2: Relay account submitting transaction...');
		const hash = await relayWalletClient.sendTransaction({
			to: authorizerAccount.address, // The transaction sets the code on the authorizer's address
			value: 0n,
			authorizationList: [authorization],
			data: '0x' as Hex
		});

		console.log('Authorization transaction submitted by relayer:', hash);
		return hash;
	} catch (error) {
		console.error('Error in signAuthorizationForRelayer:', error);
		throw error;
	}
}

// --- Helper Functions (Kept from original file) ---

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
