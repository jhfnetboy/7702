import { AUTHORIZER_PRIVATE_KEY, RELAY_PRIVATE_KEY } from '$env/static/private';
import { privateKeyToAccount } from 'viem/accounts';
import { fail } from '@sveltejs/kit';
import { signAuthorizationForRelayer } from '$lib/authorizationManager';
import type { Address, Hex } from 'viem';

/**
 * Sanitizes and validates a private key string from an environment variable.
 * @param key - The private key string to process.
 * @param keyName - The name of the environment variable for error messages.
 * @returns A clean, 64-character hex string (without 0x prefix).
 */
function getSanitizedPrivateKey(key: string | undefined, keyName: string): string {
	if (typeof key !== 'string' || !key) {
		throw new Error(`Private key variable "${keyName}" is not defined in your .env file.`);
	}

	// 1. Trim whitespace, 2. Remove quotes, 3. Remove potential 0x prefix
	const cleanedKey = key.trim().replace(/^"|"$/g, '').replace(/^0x/, '');

	// 4. Check for invalid characters
	if (!/^[0-9a-fA-F]+$/.test(cleanedKey)) {
		throw new Error(
			`Private key "${keyName}" contains non-hexadecimal characters. Please check your .env file.`
		);
	}

	// 5. Check for correct length
	if (cleanedKey.length !== 64) {
		throw new Error(
			`Private key "${keyName}" has an invalid length after cleaning (got ${cleanedKey.length}, expected 64 hex characters). Please check your .env file.`
		);
	}

	return cleanedKey;
}

// This function runs on the server before the page is rendered.
export async function load() {
	try {
		const authorizerKey = getSanitizedPrivateKey(AUTHORIZER_PRIVATE_KEY, 'AUTHORIZER_PRIVATE_KEY');
		const relayerKey = getSanitizedPrivateKey(RELAY_PRIVATE_KEY, 'RELAY_PRIVATE_KEY');

		const authorizerAccount = privateKeyToAccount(`0x${authorizerKey}`);
		const relayerAccount = privateKeyToAccount(`0x${relayerKey}`);

		// Only return public, non-sensitive data to the client
		return {
			authorizerAddress: authorizerAccount.address,
			relayerAddress: relayerAccount.address,
			setupSuccess: true
		};
	} catch (error: any) {
		console.error('Failed to setup accounts on server:', error);
		return {
			setupSuccess: false,
			setupError: error.message
		};
	}
}

// This is a server-side action that the frontend can call.
export const actions = {
	runTestTransaction: async ({ request }) => {
		const formData = await request.formData();
		const delegationContractInput = formData.get('delegationContract') as Address;

		try {
			const authorizerKey = getSanitizedPrivateKey(
				AUTHORIZER_PRIVATE_KEY,
				'AUTHORIZER_PRIVATE_KEY'
			);
			const relayerKey = getSanitizedPrivateKey(RELAY_PRIVATE_KEY, 'RELAY_PRIVATE_KEY');

			if (!delegationContractInput || !/^0x[a-fA-F0-9]{40}$/.test(delegationContractInput)) {
				throw new Error('Invalid or missing delegation contract address.');
			}

			const authorizerAccount = privateKeyToAccount(`0x${authorizerKey}`);
			const relayerAccount = privateKeyToAccount(`0x${relayerKey}`);

			const hash = await signAuthorizationForRelayer(
				authorizerAccount,
				relayerAccount,
				delegationContractInput
			);

			return { success: true, txHash: hash };
		} catch (error: any) {
			console.error('Error running test transaction action:', error);
			return fail(500, { error: error.message });
		}
	}
};
