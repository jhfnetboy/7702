import { createWalletClient } from 'viem';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { sepolia } from 'viem/chains';
import { WalletClient, Transport, Chain, PublicClient, Account } from 'viem';

// Helper to create a Smart Account Client using MetaMask
export const createMetaMaskClient = async (
  walletClient: WalletClient<Transport, Chain, Account>,
  publicClient: PublicClient
) => {
  if (!walletClient.account) {
    throw new Error('WalletClient must have an account');
  }

  // Create the MetaMask Smart Account (Stateless 7702)
  // This implementation wraps an EOA that delegates to the DeleGator implementation
  const account = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    signer: {
      walletClient: walletClient,
    },
    address: walletClient.account.address, // For 7702, the address is the EOA address
  });

  // Create a Wallet Client with the Smart Account
  // This allows us to use the smart account for signing and transactions
  return createWalletClient({
    account,
    chain: sepolia,
    transport: walletClient.transport, 
  });
};
