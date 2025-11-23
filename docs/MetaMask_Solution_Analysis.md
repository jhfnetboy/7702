# MetaMask Smart Accounts Kit & EIP-7702 Solution Analysis

## 1. Problem Statement

The current implementation uses `viem` with private keys to sign EIP-7702 authorizations. This works for development but is not suitable for production dApps where users use wallets like MetaMask.

**Challenges:**
1.  **MetaMask RPC Limitations**: Standard MetaMask RPC does not yet expose a raw `eth_signAuthorization` method for arbitrary contracts due to security risks.
2.  **Proprietary Framework**: MetaMask has introduced the **Smart Accounts Kit** and **Delegation Framework** as their standard for enabling smart account features (including EIP-7702).
3.  **Custom Logic**: We need to integrate our specific business logic (SBT verification, Gasless transfers) into this new framework.

## 2. MetaMask Delegation Framework Overview

MetaMask's approach revolves around the **DeleGator** pattern:
-   **DeleGator**: The proxy contract that the EOA delegates to (via EIP-7702).
-   **DeleGatorImplementation**: The logic contract. MetaMask provides standard implementations (e.g., `HybridDeleGator`, `MultiSigDeleGator`).
-   **Caveats**: Restrictions placed on delegations (e.g., "can only call contract X", "can only spend Y amount").
-   **CaveatEnforcer**: Smart contracts that validate these caveats.

## 3. Proposed Solution

To achieve "Gasless Tx" and "Batch Tx" with "SBT Verification" using MetaMask's kit, we should align with their architecture rather than fighting it.

### 3.1. Architecture

Instead of a monolithic `SponsoredTransferDelegationV2_1.sol`, we will use:

1.  **DeleGator (EIP-7702 Mode)**: The user's EOA delegates to a `DeleGatorImplementation`.
2.  **Custom Caveat Enforcer (`SBTCaveatEnforcer`)**:
    *   We implement a custom `CaveatEnforcer` that checks for `MySBT` balance.
    *   When the user creates a delegation (permission), they attach this caveat.
    *   **Result**: The delegation is only valid if the user holds the SBT.
3.  **Execution**:
    *   **Gasless**: Use MetaMask's Bundler/Paymaster (if supported in the Kit) OR continue using our Relay but targeting the `DeleGator.execute()` function.
    *   **Batch**: `DeleGator` implementations typically support `executeBatch`.

### 3.2. Implementation Steps

#### Phase 1: Setup & Configuration
1.  Install `@metamask/smart-accounts-kit` (Done).
2.  Configure the Kit in `src/config/metamask.ts`.

#### Phase 2: Smart Contract Adaptation (If needed)
*If MetaMask allows arbitrary 7702 delegation via the Kit:*
-   We can keep our `SponsoredTransferDelegationV2_1.sol`.
-   Use the Kit to request the signature.

*If MetaMask forces `DeleGator` usage (More likely):*
-   Deploy a `SBTCaveatEnforcer`.
-   Construct a delegation that requires this caveat.

#### Phase 3: Frontend Integration
1.  Replace `useEIP7702.ts` (Viem-based) with a new hook using Smart Accounts Kit.
2.  Implement `connect` flow using the Kit.
3.  Implement `sendTransaction` flow (which handles the 7702 auth + execution).

## 4. Technical Feasibility

-   **Gasless**: The Kit supports ERC-4337. EIP-7702 is often treated as a way to enable 4337 on EOAs. We need to check if the Kit exposes a "Relay" mode for 7702 specifically or if we route through a Bundler.
-   **Batching**: Supported natively by Smart Accounts.

## 5. Recommendation

**Step 1**: Try to use the Smart Accounts Kit to sign an authorization for our **existing** `SponsoredTransferDelegationV2_1` contract.
-   *Why*: Least resistance. If the Kit allows "Bring Your Own Implementation", we don't need to rewrite contracts.
-   *Risk*: MetaMask might block non-standard implementations.

**Step 2 (Fallback)**: If Step 1 fails, adopt the `DeleGator` + `Caveat` pattern.

## 6. Next Actions

1.  Create a reproduction script/component to try signing a 7702 auth for our existing contract using the Kit.
2.  If successful, proceed with integration.
3.  If not, pivot to `DeleGator` architecture.
