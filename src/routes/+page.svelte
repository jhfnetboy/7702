<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let isProcessing = false;

  $: {
    if (form) {
      isProcessing = false;
    }
  }
</script>

<svelte:head>
  <title>AirAccount 7702 Test Demo</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        AirAccount 7702 Test Demo
      </h1>
      <p class="text-gray-600">
        A test environment for EIP-7702 using a dedicated Authorizer and a Relayer for gas fees.
      </p>
    </div>

    <!-- Main Card -->
    <div class="bg-white shadow-lg rounded-lg overflow-hidden">
      <div class="p-6 sm:p-8">
        {#if !data.setupSuccess}
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 class="text-lg font-medium text-red-900 mb-2">Configuration Error</h3>
            <p class="text-red-800 break-all">{data.setupError}</p>
            <p class="text-red-700 mt-2 text-sm">Please ensure your `.env` file contains the correct private key variables (e.g., `AUTHORIZER_PRIVATE_KEY` and `RELAY_PRIVATE_KEY`).</p>
          </div>
        {:else}
          <div class="space-y-6">
            <!-- Account Info -->
            <div class="space-y-4">
              <div class="bg-gray-50 rounded-lg p-4 border">
                <p class="text-sm text-gray-500">Authorizer Account (Signs the authorization)</p>
                <p class="text-lg font-mono font-medium text-gray-900 break-all">
                  {data.authorizerAddress}
                </p>
              </div>
              <div class="bg-gray-50 rounded-lg p-4 border">
                <p class="text-sm text-gray-500">Relayer Account (Pays for Gas)</p>
                <p class="text-lg font-mono font-medium text-gray-900 break-all">
                  {data.relayerAddress}
                </p>
              </div>
            </div>

            <!-- Status Messages -->
            {#if isProcessing}
               <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-center">
                  <svg class="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p class="text-blue-800">Processing transaction on the server...</p>
                </div>
              </div>
            {/if}

            {#if form?.error}
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                  <svg class="h-5 w-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <p class="text-red-800 break-all">{form.error}</p>
                </div>
              </div>
            {/if}

            {#if form?.success}
              <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-sm text-green-800 mb-2 font-medium">Transaction Submitted Successfully!</p>
                <p class="text-sm text-blue-600 hover:text-blue-700 underline font-mono break-all">
                  {form.txHash}
                </p>
              </div>
            {/if}

            <!-- Action Section -->
            <div class="border-t pt-6">
              <form method="POST" action="?/runTestTransaction" use:enhance={() => {
                isProcessing = true;
                return async ({ update }) => {
                  await update();
                };
              }}>
                 <div class="space-y-4">
                    <div>
                      <label for="contract-address" class="block text-sm font-medium text-gray-700 mb-2">
                        Delegation Contract Address
                      </label>
                      <input
                        id="contract-address"
                        name="delegationContract"
                        type="text"
                        placeholder="0x..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      class="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if isProcessing}
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      {:else}
                        Run Test Transaction
                      {/if}
                    </button>
                  </div>
              </form>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
