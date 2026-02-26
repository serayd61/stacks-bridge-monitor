# CLAUDE.md - Stacks Bridge Monitor

## Project Overview

Stacks Bridge Monitor is a full-stack Stacks blockchain bridge platform with 10 Clarity smart contracts and a real-time monitoring dashboard. It covers cross-chain bridge operations, governance, staking, AMM, and NFT rewards on the Stacks blockchain.

**Author:** serayd61
**License:** MIT

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Clarity v2 (Stacks blockchain, epoch 2.5) |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3.4 with custom theme colors |
| Icons | Lucide React |
| External APIs | Hiro Stacks API, Blockstream Bitcoin API, CoinGecko |
| Contract Testing | Vitest + Clarinet simnet |
| Contract Tooling | Clarinet |
| Deployment | Vercel |

## Repository Structure

```
stacks-bridge-monitor/
├── contracts/                    # 10 Clarity smart contracts
│   ├── bridge-token.clar         # SIP-010 fungible token (mint/burn for bridge ops)
│   ├── bridge-registry.clar      # Peg-in/peg-out management, tx tracking
│   ├── fee-manager.clar          # Fee collection, tiered pricing, distribution
│   ├── governance.clar           # DAO proposals, voting, delegation
│   ├── staking-vault.clar        # Flexible & locked staking with multipliers
│   ├── liquidity-pool.clar       # Constant-product AMM (x*y=k)
│   ├── oracle.clar               # Decentralized price feeds, TWAP
│   ├── multisig-treasury.clar    # M-of-N treasury management
│   ├── nft-rewards.clar          # SIP-009 achievement NFTs (5 tiers)
│   └── timelock-controller.clar  # Time-delayed execution, emergency pause
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main dashboard (async server component)
│   ├── layout.tsx                # Root layout (Inter font, metadata)
│   ├── globals.css               # Global styles, Tailwind directives, custom animations
│   └── api/                      # API route handlers
│       ├── bridges/route.ts      # Bridge stats endpoint
│       ├── health/route.ts       # Health check endpoint
│       └── sbtc/route.ts         # sBTC stats endpoint
├── components/                   # React UI components
│   ├── StatsCard.tsx             # Stat display card with trend indicators
│   ├── TransactionTable.tsx      # Recent bridge transactions table
│   ├── PriceChart.tsx            # sBTC/BTC peg ratio display
│   ├── NetworkStatus.tsx         # Stacks & Bitcoin network health
│   ├── PriceHeader.tsx           # Top price ticker bar
│   ├── TokenTable.tsx            # Top tokens by market cap
│   ├── DeFiProtocols.tsx         # DeFi protocol TVL listing
│   ├── NFTCollections.tsx        # NFT collection stats
│   ├── EcosystemStats.tsx        # Ecosystem-wide statistics
│   └── QuickLinks.tsx            # Useful ecosystem links
├── lib/
│   └── api.ts                    # API fetch functions & TypeScript interfaces
├── src/utils/                    # Utility functions
├── tests/
│   └── contracts/                # Clarinet contract tests (Vitest)
│       ├── bridge-token.test.ts
│       ├── bridge-registry.test.ts
│       ├── governance.test.ts
│       ├── multisig-treasury.test.ts
│       └── staking-vault.test.ts
├── settings/
│   └── Devnet.toml               # Clarinet devnet configuration (5 test accounts)
├── docs/
│   └── CHANGELOG.md              # Version changelog
├── public/                       # Static assets
├── Clarinet.toml                 # Clarinet project configuration
├── package.json                  # Node.js dependencies & scripts
├── tsconfig.json                 # TypeScript config (strict mode, bundler resolution)
├── tailwind.config.js            # Tailwind config with custom theme
├── postcss.config.js             # PostCSS config
└── next.config.js                # Next.js config (strict mode)
```

## Build & Development Commands

### Dashboard (Next.js)

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run Next.js linter (ESLint)
```

### Smart Contracts (Clarinet)

```bash
clarinet check       # Validate all 10 contracts
clarinet test        # Run contract tests via Vitest
clarinet console     # Interactive REPL with deployed contracts
clarinet devnet start  # Launch local devnet
```

## Architecture & Patterns

### Next.js App Router

- Uses the **App Router** (`app/` directory), not Pages Router
- The main page (`app/page.tsx`) is an **async server component** — data fetching happens server-side via `Promise.all`
- ISR revalidation is set to **30 seconds** (`export const revalidate = 30`)
- API routes use Next.js Route Handlers (`app/api/*/route.ts`) with `NextResponse.json()`
- Path aliases use `@/*` mapping to root (configured in `tsconfig.json`)

### Component Conventions

- Components live in `components/` (flat structure, no nesting)
- Client components use the `'use client'` directive at the top
- Server components (like `page.tsx`) are the default — no directive needed
- Each component is a **default export** in its own file (PascalCase filename)
- Props are defined as TypeScript interfaces directly in the component file
- Icons come from `lucide-react` — never import icon SVGs directly

### Styling

- Tailwind CSS is the only styling approach — no CSS modules, styled-components, etc.
- Custom theme colors defined in `tailwind.config.js`:
  - `stacks-purple: #5546FF`
  - `stacks-dark: #0C0C0D`
  - `bitcoin-orange: #F7931A`
- Custom CSS classes in `globals.css`: `.glow-purple`, `.glow-orange`, `.glow-green`, `.animate-pulse-slow`, `.animate-slide-up`
- Dark theme only — background uses gradient from `#0C0C0D` to `#141419`
- Card pattern: `rounded-xl border border-gray-800 bg-gray-900/50 p-6`

### Data Fetching (`lib/api.ts`)

- All API functions are in `lib/api.ts` with TypeScript interfaces
- External API base URLs:
  - Stacks: `https://api.hiro.so`
  - Bitcoin: `https://blockstream.info/api`
  - Prices: `https://api.coingecko.com/api/v3`
- Every fetch function includes a **fallback return** with mock/default data on failure
- Next.js `fetch` caching uses `{ next: { revalidate: N } }` with 30-60s intervals
- Utility functions: `formatNumber()`, `formatUSD()`, `timeAgo()`

### Smart Contract Conventions (Clarity)

- All contracts use **Clarity v2** on **epoch 2.5**
- Contracts follow a consistent structure:
  1. Header comment block with contract name and description
  2. Trait implementations (SIP-010, SIP-009)
  3. Constants (CONTRACT-OWNER, error codes as `ERR-*`)
  4. Token/NFT definitions
  5. Data variables and maps
  6. Initialization
  7. Public functions (grouped by section with comment dividers)
  8. Read-only functions
- Error codes are namespaced by contract (1000s for token, 2000s for registry, etc.)
- Constants use `UPPER-KEBAB-CASE`
- Functions use `lower-kebab-case`
- All contracts have the deployer as `CONTRACT-OWNER` set via `tx-sender` at deploy time

### Contract Deployment Order (Dependencies)

1. `bridge-token` — no dependencies
2. `fee-manager` — no dependencies
3. `oracle` — no dependencies
4. `bridge-registry` — depends on token + fees
5. `governance` — depends on token
6. `staking-vault` — depends on token
7. `liquidity-pool` — depends on token
8. `multisig-treasury` — depends on token
9. `nft-rewards` — depends on registry
10. `timelock-controller` — wraps admin operations

This order is also reflected in `settings/Devnet.toml`.

### Testing

- Contract tests use **Vitest** with Clarinet's `simnet` global
- Tests import `{ Cl }` from `@stacks/transactions` for Clarity value construction
- Test accounts come from `simnet.getAccounts()`: `deployer`, `wallet_1`, `wallet_2`, etc.
- Tests use `simnet.callPublicFn()` and `simnet.callReadOnlyFn()`
- Assertions use `.toBeOk()`, `.toBeErr()`, and standard Vitest matchers
- Test files are in `tests/contracts/` with naming pattern `{contract-name}.test.ts`
- Tests are organized with nested `describe` blocks by feature area

## Configuration Details

### TypeScript (`tsconfig.json`)

- `strict: true` — all strict checks enabled
- `target: ES2017`, `module: esnext`, `moduleResolution: bundler`
- `jsx: preserve` for Next.js
- Path alias: `@/*` maps to `./*`

### Clarinet (`Clarinet.toml`)

- Telemetry disabled
- REPL analysis with `check_checker` pass (non-strict mode)
- All 10 contracts registered with Clarity v2, epoch 2.5

### Devnet (`settings/Devnet.toml`)

- 5 test accounts (deployer + 4 wallets) each with 100M STX
- Stacks API on port 3999, Explorer on port 3002
- Bitcoin RPC on port 18443, P2P on port 18444
- Block time: 30 seconds

## Key Interfaces (TypeScript)

Important types defined in `lib/api.ts`:

- `BridgeStats` — 24h/7d volumes, transaction counts, active users
- `SBTCData` — sBTC supply, BTC/sBTC prices, holder count
- `STXData` — STX price, market cap, volume, supply
- `RecentTransaction` — tx type (peg-in/peg-out), amount, status, addresses
- `DeFiProtocol` — name, TVL, 24h change, category
- `NFTCollection` — name, floor price, volume, item count
- `StacksStats` — block height, total txs, accounts, contracts
- `NetworkHealth` — status (healthy/degraded/down), latency, uptime
- `GasTracker` — fee tiers (slow/standard/fast/instant)
- `HistoricalData` — date + value pairs for charts

## Important Notes for AI Assistants

### Do's

- Use Tailwind utility classes for all styling
- Add `'use client'` directive to components that use hooks, event handlers, or browser APIs
- Keep data fetching in `lib/api.ts` and always include fallback/mock data on API errors
- Use `@/` path alias for imports
- Follow existing error code numbering conventions when adding contract errors
- Use `Cl.*` helpers from `@stacks/transactions` when writing contract tests
- Match the existing card/panel design: `rounded-xl border border-gray-800 bg-gray-900/50`

### Don'ts

- Don't use CSS modules or styled-components — Tailwind only
- Don't add Pages Router files in `pages/` — this project uses App Router
- Don't import icons as SVG files — use `lucide-react`
- Don't bypass error handling in API functions — always return sensible defaults
- Don't change the Clarity version or epoch in contract definitions without reason
- Don't modify `settings/Devnet.toml` test account mnemonics
