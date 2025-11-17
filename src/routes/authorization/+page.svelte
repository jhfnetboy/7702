<script lang="ts">
  import { onMount } from 'svelte';
  import type { Address, Hex } from 'viem';
  import {
    checkAuthorizationStatus,
    signAuthorization,
    revokeAuthorization,
    getDefaultDelegationContract,
    getTransactionUrl,
    getAddressUrl,
    formatAddress,
    type AuthorizationStatus
  } from '$lib/authorizationManager';

  // State management
  let isConnected = false;
  let isConnecting = false;
  let connectedAddress: Address | null = null;
  let authStatus: AuthorizationStatus | null = null;
  let isCheckingStatus = false;
  let delegationContractInput = '';
  let isProcessing = false;
  let statusMessage = '';
  let errorMessage = '';
  let txHash: Hex | null = null;

  // Initialize on mount
  onMount(() => {
    // Set default delegation contract
    delegationContractInput = getDefaultDelegationContract();

    // Check if already connected
    checkExistingConnection();
  });

  /**
   * Check if MetaMask is already connected
   */
  async function checkExistingConnection() {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        connectedAddress = accounts[0] as Address;
        isConnected = true;
        await checkStatus();
      }
    } catch (error) {
      console.error('Error checking existing connection:', error);
    }
  }

  /**
   * Connect to MetaMask
   */
  async function connectWallet() {
    if (!window.ethereum) {
      errorMessage = 'MetaMask is not installed. Please install MetaMask to continue.';
      return;
    }

    try {
      isConnecting = true;
      errorMessage = '';

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        connectedAddress = accounts[0] as Address;
        isConnected = true;
        await checkStatus();
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      errorMessage = error.message || 'Failed to connect wallet';
    } finally {
      isConnecting = false;
    }
  }

  /**
   * Disconnect wallet
   */
  function disconnectWallet() {
    connectedAddress = null;
    isConnected = false;
    authStatus = null;
    statusMessage = '';
    errorMessage = '';
    txHash = null;
  }

  /**
   * Check authorization status for the connected address
   */
  async function checkStatus() {
    if (!connectedAddress) return;

    try {
      isCheckingStatus = true;
      errorMessage = '';
      statusMessage = 'Checking authorization status...';

      authStatus = await checkAuthorizationStatus(connectedAddress);
      statusMessage = '';
    } catch (error: any) {
      console.error('Error checking status:', error);
      errorMessage = error.message || 'Failed to check authorization status';
      statusMessage = '';
    } finally {
      isCheckingStatus = false;
    }
  }

  /**
   * Sign authorization for delegation
   */
  async function handleSignAuthorization() {
    if (!connectedAddress || !delegationContractInput) return;

    try {
      isProcessing = true;
      errorMessage = '';
      txHash = null;
      statusMessage = 'Requesting signature from MetaMask...';

      // Validate contract address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(delegationContractInput)) {
        throw new Error('Invalid contract address format');
      }

      const hash = await signAuthorization(
        connectedAddress,
        delegationContractInput as Address
      );

      txHash = hash;
      statusMessage = 'Authorization signed successfully! Waiting for confirmation...';

      // Wait a bit for the transaction to be mined
      setTimeout(async () => {
        await checkStatus();
        statusMessage = 'Authorization completed!';
      }, 3000);
    } catch (error: any) {
      console.error('Error signing authorization:', error);
      if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else {
        errorMessage = error.message || 'Failed to sign authorization';
      }
      statusMessage = '';
    } finally {
      isProcessing = false;
    }
  }

  /**
   * Revoke authorization
   */
  async function handleRevokeAuthorization() {
    if (!connectedAddress) return;

    // Confirm before revoking
    const confirmed = confirm(
      'Are you sure you want to revoke the authorization? This will remove the delegated contract code from your account.'
    );

    if (!confirmed) return;

    try {
      isProcessing = true;
      errorMessage = '';
      txHash = null;
      statusMessage = 'Requesting revocation signature from MetaMask...';

      const hash = await revokeAuthorization(connectedAddress);

      txHash = hash;
      statusMessage = 'Revocation signed successfully! Waiting for confirmation...';

      // Wait a bit for the transaction to be mined
      setTimeout(async () => {
        await checkStatus();
        statusMessage = 'Authorization revoked!';
      }, 3000);
    } catch (error: any) {
      console.error('Error revoking authorization:', error);
      if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else {
        errorMessage = error.message || 'Failed to revoke authorization';
      }
      statusMessage = '';
    } finally {
      isProcessing = false;
    }
  }

  // Listen for account changes
  if (typeof window !== 'undefined' && window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        connectedAddress = accounts[0] as Address;
        checkStatus();
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
</script>

<svelte:head>
  <title>EIP-7702 Authorization Manager</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        EIP-7702 Authorization Manager
      </h1>
      <p class="text-gray-600">
        Manage contract delegation for your Ethereum account
      </p>
    </div>

    <!-- Main Card -->
    <div class="bg-white shadow-lg rounded-lg overflow-hidden">
      <div class="p-6 sm:p-8">

        <!-- Connection Status -->
        {#if !isConnected}
          <div class="text-center py-8">
            <div class="mb-4">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 class="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h2>
            <p class="text-gray-500 mb-6">
              Connect MetaMask to manage EIP-7702 authorizations
            </p>
            <button
              on:click={connectWallet}
              disabled={isConnecting}
              class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isConnecting}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              {:else}
                Connect MetaMask
              {/if}
            </button>
          </div>
        {:else}
          <!-- Connected View -->
          <div class="space-y-6">

            <!-- Account Info -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500">Connected Account</p>
                  <p class="text-lg font-mono font-medium text-gray-900">
                    {connectedAddress}
                  </p>
                </div>
                <button
                  on:click={disconnectWallet}
                  class="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Disconnect
                </button>
              </div>
            </div>

            <!-- Status Messages -->
            {#if statusMessage}
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-center">
                  <svg class="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p class="text-blue-800">{statusMessage}</p>
                </div>
              </div>
            {/if}

            {#if errorMessage}
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                  <svg class="h-5 w-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <p class="text-red-800">{errorMessage}</p>
                </div>
              </div>
            {/if}

            {#if txHash}
              <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-sm text-green-800 mb-2 font-medium">Transaction Submitted</p>
                <a
                  href={getTransactionUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-blue-600 hover:text-blue-700 underline font-mono break-all"
                >
                  {txHash}
                </a>
              </div>
            {/if}

            <!-- Authorization Status -->
            {#if authStatus && !isCheckingStatus}
              {#if authStatus.isAuthorized}
                <!-- Authorized View -->
                <div class="border-2 border-green-200 rounded-lg p-6 bg-green-50">
                  <div class="flex items-start">
                    <div class="flex-shrink-0">
                      <svg class="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="ml-3 flex-1">
                      <h3 class="text-lg font-medium text-green-900 mb-4">
                        Authorization Active
                      </h3>

                      {#if authStatus.delegatedContract}
                        <div class="space-y-3">
                          <div>
                            <p class="text-sm text-green-700 mb-1">Delegated Contract Address:</p>
                            <div class="flex items-center space-x-2">
                              <code class="text-sm font-mono bg-white px-3 py-2 rounded border border-green-200 text-gray-900">
                                {authStatus.delegatedContract}
                              </code>
                              <a
                                href={getAddressUrl(authStatus.delegatedContract)}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center text-blue-600 hover:text-blue-700"
                                title="View on Etherscan"
                              >
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </div>

                          {#if authStatus.code}
                            <div>
                              <p class="text-sm text-green-700 mb-1">Account Code:</p>
                              <code class="text-xs font-mono bg-white px-3 py-2 rounded border border-green-200 text-gray-700 block overflow-x-auto">
                                {authStatus.code}
                              </code>
                            </div>
                          {/if}
                        </div>
                      {/if}

                      <div class="mt-6">
                        <button
                          on:click={handleRevokeAuthorization}
                          disabled={isProcessing}
                          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {#if isProcessing}
                            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          {:else}
                            Revoke Authorization
                          {/if}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Not Authorized View -->
                <div class="border-2 border-gray-200 rounded-lg p-6">
                  <h3 class="text-lg font-medium text-gray-900 mb-4">
                    Set Up Authorization
                  </h3>
                  <p class="text-sm text-gray-600 mb-6">
                    Authorize a delegation contract to enable EIP-7702 functionality. This allows your account to temporarily execute contract code.
                  </p>

                  <div class="space-y-4">
                    <div>
                      <label for="contract-address" class="block text-sm font-medium text-gray-700 mb-2">
                        Delegation Contract Address
                      </label>
                      <input
                        id="contract-address"
                        type="text"
                        bind:value={delegationContractInput}
                        placeholder="0x..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                      <p class="mt-2 text-xs text-gray-500">
                        Default: BatchCallDelegation contract for batch transfers
                      </p>
                    </div>

                    <button
                      on:click={handleSignAuthorization}
                      disabled={isProcessing || !delegationContractInput}
                      class="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if isProcessing}
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      {:else}
                        Sign Authorization
                      {/if}
                    </button>
                  </div>
                </div>
              {/if}
            {/if}

            {#if isCheckingStatus}
              <div class="text-center py-8">
                <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-gray-600">Checking authorization status...</p>
              </div>
            {/if}

            <!-- Refresh Button -->
            <div class="pt-4 border-t border-gray-200">
              <button
                on:click={checkStatus}
                disabled={isCheckingStatus}
                class="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Status
              </button>
            </div>
          </div>
        {/if}

      </div>
    </div>

    <!-- Info Section -->
    <div class="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-6">
      <h2 class="text-lg font-medium text-blue-900 mb-3">What is EIP-7702?</h2>
      <div class="text-sm text-blue-800 space-y-2">
        <p>
          EIP-7702 allows Externally Owned Accounts (EOAs) to temporarily designate contract code for execution. This enables features like:
        </p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li>Batch transactions - execute multiple operations in one transaction</li>
          <li>Gas sponsorship - allow others to pay gas fees for your transactions</li>
          <li>Advanced smart contract functionality without deploying a contract wallet</li>
        </ul>
        <p class="mt-3">
          <strong>Important:</strong> The relay account pays the gas fees for authorization transactions, making it free for users to set up!
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  /* Additional styles if needed */
</style>
