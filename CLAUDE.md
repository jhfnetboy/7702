# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EIP-7702 Viem Demo** is a full-stack application demonstrating EIP-7702 (Set Code) functionality using the Viem library. The project enables testing and exploration of Ethereum account delegation patterns with a modern tech stack.

**Key Purpose**: Showcase EIP-7702 capabilities through a Svelte-based frontend with TypeScript support.

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 + TypeScript + Tailwind CSS
- **Smart Contracts**: Solidity (Foundry for testing/deployment)
- **Core Library**: Viem 2.x
- **Build**: Vite + SvelteKit
- **Styling**: Tailwind CSS v4
- **Deployment**: Netlify (via SvelteKit adapter)
- **Package Manager**: pnpm (preferred), also supports npm

## Project Structure

```
7702/
├── src/                        # Frontend application (SvelteKit)
│   ├── app.d.ts               # SvelteKit app types
│   ├── lib/
│   │   ├── wallet.ts          # Wallet connection logic (Viem)
│   │   ├── chainConfig.ts      # Blockchain network configuration
│   │   ├── batchTransfer.ts    # EIP-7702 batch operations
│   │   ├── index.ts           # Library exports
│   │   └── components/        # Reusable UI components
│   │       ├── PrivateKeyInput.svelte
│   │       ├── WalletInfo.svelte
│   │       ├── SigningModal.svelte
│   │       └── Navbar.svelte
│   ├── components/            # Page-specific components
│   │   └── NetworkSwitch.svelte
│   └── routes/                # SvelteKit pages
│       ├── +layout.svelte      # Root layout
│       ├── +page.svelte        # Home page
│       ├── batch-transfer/     # Batch transfer demo
│       └── custom-contract/    # Custom contract interaction
├── contracts/                 # Smart contracts (Foundry)
│   ├── src/                   # Contract source files
│   ├── test/                  # Contract tests
│   ├── script/                # Deployment scripts
│   ├── foundry.toml           # Foundry config
│   └── README.md              # Contract documentation
├── openspec/                  # Specification management
│   ├── project.md             # Project conventions (NEEDS UPDATE)
│   ├── AGENTS.md              # OpenSpec workflow guide
│   ├── specs/                 # Current capabilities
│   └── changes/               # Proposed changes
├── docs/                      # User documentation
│   ├── 7702-PRD.md           # Product requirements
│   ├── EIP7702-Hybrid-Implementation.md
│   ├── README.md              # Detailed documentation
│   └── USER_FEEDBACK_FORM.md
├── vite.config.ts            # Vite configuration
├── svelte.config.js           # SvelteKit configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies (pnpm preferred)
└── pnpm-lock.yaml             # Lock file (use pnpm)
```

## Development Commands

### Setup & Build

```bash
# Install dependencies
pnpm install

# Development server (runs on http://localhost:5173 by default)
pnpm dev

# Build for production
pnpm build

# Preview production build locally
pnpm preview
```

### Code Quality

```bash
# Format code (Prettier)
pnpm format

# Lint code (ESLint)
pnpm lint

# Type check (Svelte)
pnpm check

# Watch type checking
pnpm check:watch
```

### Smart Contracts

```bash
# Inside contracts/ directory
cd contracts

# Compile contracts
forge build

# Run contract tests
forge test

# Run tests with verbose output
forge test -vvv

# Deploy to Sepolia testnet (requires .env)
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify
```

## Architecture Patterns

### Frontend Architecture

**Viem Integration**: The wallet and blockchain interaction logic is centralized in `src/lib/` using Viem:
- `wallet.ts`: Viem-based wallet connection and transaction creation
- `chainConfig.ts`: Network configuration (RPC URLs, contract addresses)
- `batchTransfer.ts`: EIP-7702 specific operations

**SvelteKit Structure**: Uses file-based routing:
- Pages defined as `+page.svelte` in `src/routes/`
- Shared layout in `src/routes/+layout.svelte`
- Components organized by scope (shared vs. page-specific)

**Styling**: Tailwind CSS v4 with:
- `@tailwindcss/forms` for form components
- `@tailwindcss/typography` for content areas
- `prettier-plugin-tailwindcss` for class sorting

### Smart Contract Patterns

- **Foundry-based**: Uses `forge` for testing and deployment
- **Library dependencies**: OpenZeppelin contracts managed via Git submodules in `lib/`
- **Test location**: `contracts/test/` with `.t.sol` suffix convention

## Configuration Files

### Environment Variables (.env)

Required for contract deployment and backend operations:
```bash
# Example .env (create from .env.example)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
```

Frontend environment variables are configured in `src/lib/chainConfig.ts` (no `.env.frontend` needed).

### TypeScript

**tsconfig.json**: Configured for:
- ES2020 target with module resolution
- Path aliases (if defined)
- Strict mode enabled

### SvelteKit

**svelte.config.js**:
- Uses Netlify adapter for deployment
- Vite preprocessor for Svelte

**vite.config.ts**: Standard Vite configuration

## Code Style & Conventions

### TypeScript
- Use TypeScript for all new code
- Strict mode enabled (`"strict": true` in tsconfig.json)
- Import paths prefer `/src/lib` exports

### Svelte Components
- Use `<script lang="ts">` in all components
- Reactive declarations (`let`, `$:`) for state
- Props typed with interfaces
- Format with Prettier (run `pnpm format`)

### Naming
- Components: PascalCase (`WalletInfo.svelte`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Routes: kebab-case (`batch-transfer`)

### Comments
- All code comments in English
- Responses/communication in Chinese

## Testing Strategy

### Frontend
- Type checking via `pnpm check`
- Manual testing via dev server (`pnpm dev`)
- No unit test framework currently configured

### Smart Contracts
- Tests written in Solidity (`.t.sol` files)
- Run with `forge test`
- Use `-vvv` flag for detailed output

## OpenSpec Workflow

This project uses OpenSpec for spec-driven development:

1. **Read** `openspec/AGENTS.md` when the request mentions:
   - Planning or proposals (words: proposal, spec, change, plan)
   - New capabilities, breaking changes, architecture shifts
   - Performance/security improvements

2. **Check** `openspec/project.md` for:
   - Project conventions (currently needs completion)
   - Domain context
   - Important constraints

3. **Create proposals** for:
   - New features or capabilities
   - Breaking changes (API, schema)
   - Architecture changes
   - Performance optimizations

4. **Skip proposals** for:
   - Bug fixes restoring intended behavior
   - Typos, formatting, comments
   - Non-breaking dependency updates
   - Tests for existing behavior

**Key Commands**:
```bash
openspec list                    # View active changes
openspec list --specs            # View current capabilities
openspec show [change-id]        # View change details
openspec validate [change-id] --strict  # Validate changes
openspec archive [change-id] --yes      # Archive after deployment
```

## Git Workflow

- **Main branch**: `main` (protected)
- **Feature branches**: Create from `main`, use conventional commits
- **Commit messages**: Follow conventional commits (feat:, fix:, docs:, etc.)
- **PRs required**: For all changes to `main`

## Important Notes

### Package Manager
- **Use `pnpm`** (not npm) - specified in scripts and lock file
- Dependencies: Viem 2.x, SvelteKit 2.x, Svelte 5.x

### EIP-7702 Context
- Project focuses on EIP-7702 (Set Code TX) exploration
- Uses Viem for Ethereum interactions
- Primarily targets Sepolia testnet
- Demonstrates account delegation patterns

### Development Considerations
- No ETH required for testing (testnet)
- WebAuthn support mentioned in docs (verify implementation status)
- Paymaster and Relayer fallback mechanisms described in docs

### Documentation
- User guides in `docs/`
- PRD in `docs/7702-PRD.md`
- Tech details in `docs/EIP7702-Hybrid-Implementation.md`
- Update docs when changing behavior

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->