# Stacks Bridge Ecosystem

Full-stack Stacks blockchain bridge platform with **10 Clarity smart contracts**, real-time monitoring dashboard, and DeFi infrastructure. Cross-chain bridge operations, governance, staking, AMM, and NFT rewards on Stacks.

## Smart Contracts (10)

| # | Contract | File | Description |
|---|----------|------|-------------|
| 1 | **Bridge Token** | `bridge-token.clar` | SIP-010 fungible token with mint/burn for bridge operations |
| 2 | **Bridge Registry** | `bridge-registry.clar` | Peg-in/peg-out management, transaction tracking, operator system |
| 3 | **Fee Manager** | `fee-manager.clar` | Fee collection, tiered pricing, distribution to treasury/stakers/LPs |
| 4 | **Governance DAO** | `governance.clar` | On-chain proposals, voting, delegation, execution with timelock |
| 5 | **Staking Vault** | `staking-vault.clar` | Flexible & locked staking with multipliers (1x-3x), reward distribution |
| 6 | **Liquidity Pool** | `liquidity-pool.clar` | Constant-product AMM (x*y=k) for BRIDGE/STX trading |
| 7 | **Oracle** | `oracle.clar` | Decentralized price feeds, TWAP, multi-reporter aggregation |
| 8 | **Multi-Sig Treasury** | `multisig-treasury.clar` | M-of-N treasury management with spending limits |
| 9 | **NFT Rewards** | `nft-rewards.clar` | SIP-009 achievement NFTs with 5 tiers (Bronze to Diamond) |
| 10 | **Timelock Controller** | `timelock-controller.clar` | Time-delayed execution, emergency pause, guardian system |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Stacks Bridge Ecosystem                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Bitcoin     │  │  Ethereum    │  │      Stacks Network    │  │
│  │   Network     │  │  Network     │  │                        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘  │
│         │                 │                      │               │
│         └─────────────────┼──────────────────────┘               │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │                   SMART CONTRACTS LAYER                      │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐     │ │
│  │  │ Bridge Token │  │ Bridge       │  │ Fee Manager    │     │ │
│  │  │ (SIP-010)   │  │ Registry     │  │                │     │ │
│  │  └─────────────┘  └──────────────┘  └────────────────┘     │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐     │ │
│  │  │ Governance  │  │ Staking      │  │ Liquidity Pool │     │ │
│  │  │ DAO         │  │ Vault        │  │ (AMM)          │     │ │
│  │  └─────────────┘  └──────────────┘  └────────────────┘     │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐     │ │
│  │  │ Oracle      │  │ Multi-Sig    │  │ NFT Rewards    │     │ │
│  │  │             │  │ Treasury     │  │ (SIP-009)      │     │ │
│  │  └─────────────┘  └──────────────┘  └────────────────┘     │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │           Timelock Controller (Emergency)             │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │                   MONITORING DASHBOARD                       │ │
│  │  Next.js 14 | React 18 | Tailwind CSS | TypeScript          │ │
│  │  Real-time analytics, price tracking, network health         │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) (for smart contract development)
- [Node.js](https://nodejs.org/) 18+ (for dashboard)
- npm or yarn

### Installation

```bash
git clone https://github.com/serayd61/stacks-bridge-monitor.git
cd stacks-bridge-monitor
npm install
```

### Smart Contract Development

```bash
# Check all contracts
clarinet check

# Run contract tests
clarinet test

# Launch local devnet
clarinet devnet start

# Open Clarinet console (interactive REPL)
clarinet console
```

### Dashboard Development

```bash
npm run dev       # Start development server
npm run build     # Production build
npm start         # Start production server
```

## Contract Details

### 1. Bridge Token (SIP-010)
- Standard fungible token for bridge operations
- Authorized minter/burner system for bridge contracts
- Mint (peg-in) and burn (peg-out) functionality
- Pause controls for emergency situations
- Max supply: 1 Billion tokens (6 decimals)

### 2. Bridge Registry
- Records all peg-in/peg-out transactions
- Bitcoin TXID double-spend prevention
- Operator-based multi-signer system
- Transaction lifecycle: Pending -> Confirmed -> Completed
- Volume tracking and statistics

### 3. Fee Manager
- Volume-based tiered fees (Bronze 0.25% -> Diamond 0.05%)
- Fee distribution: 40% Treasury, 40% Stakers, 20% LPs
- Whitelist for zero-fee addresses
- Epoch-based fee tracking
- Claim cooldown system

### 4. Governance DAO
- On-chain proposal creation and voting
- Delegated voting power
- Configurable voting period (~7 days default)
- Execution delay for security
- Quorum requirements

### 5. Staking Vault
- Flexible staking (1x multiplier)
- 30-day lock (1.5x multiplier)
- 90-day lock (2x multiplier)
- 180-day lock (3x multiplier)
- Auto-compounding reward distribution

### 6. Liquidity Pool (AMM)
- Constant-product formula (x*y=k)
- BRIDGE/STX trading pair
- 0.3% swap fee
- LP token minting/burning
- Price quotes and slippage protection

### 7. Oracle
- Multi-reporter price feeds
- BTC/USD, STX/USD, BRIDGE/USD, BTC/STX, BRIDGE/STX
- Time-Weighted Average Price (TWAP)
- Staleness checks (12 hours max)
- 30% max deviation protection

### 8. Multi-Sig Treasury
- M-of-N signature scheme
- Transaction proposal, signing, execution
- Daily spending limits
- 7-day transaction expiry
- Full audit trail

### 9. NFT Rewards (SIP-009)
- 5 Achievement tiers: Bronze, Silver, Gold, Platinum, Diamond
- Based on bridge usage and volume
- Limited supply per tier (100-10,000)
- Transferable NFTs
- Achievement tracking system

### 10. Timelock Controller
- Minimum 1-day delay on critical operations
- Emergency pause system with guardian roles
- Proposer/Executor/Guardian role separation
- Grace period for execution
- Emergency cooldown after deactivation

## Project Structure

```
stacks-bridge-monitor/
├── contracts/                    # Clarity Smart Contracts
│   ├── bridge-token.clar         # SIP-010 Bridge Token
│   ├── bridge-registry.clar      # Bridge Operations Registry
│   ├── fee-manager.clar          # Fee Collection & Distribution
│   ├── governance.clar           # DAO Governance
│   ├── staking-vault.clar        # Token Staking & Rewards
│   ├── liquidity-pool.clar       # AMM Liquidity Pool
│   ├── oracle.clar               # Price Oracle
│   ├── multisig-treasury.clar    # Multi-Sig Treasury
│   ├── nft-rewards.clar          # SIP-009 NFT Rewards
│   └── timelock-controller.clar  # Timelock & Emergency
├── tests/
│   └── contracts/                # Clarinet Tests
├── settings/
│   └── Devnet.toml               # Devnet Configuration
├── app/                          # Next.js Dashboard
│   ├── api/                      # API Routes
│   ├── page.tsx                  # Main Dashboard
│   └── layout.tsx                # Root Layout
├── components/                   # React Components
├── lib/                          # Utilities
├── Clarinet.toml                 # Clarinet Project Config
├── package.json                  # Node.js Dependencies
└── README.md
```

## Deployment Order

Contracts should be deployed in this order due to dependencies:

1. `bridge-token` - Core token (no dependencies)
2. `fee-manager` - Fee logic (no dependencies)
3. `oracle` - Price feeds (no dependencies)
4. `bridge-registry` - Uses token + fees
5. `governance` - Uses token for voting
6. `staking-vault` - Uses token for staking
7. `liquidity-pool` - Uses token for AMM
8. `multisig-treasury` - Uses token for treasury
9. `nft-rewards` - Uses registry for achievements
10. `timelock-controller` - Wraps all admin operations

## Tech Stack

- **Smart Contracts**: Clarity (Stacks blockchain)
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **APIs**: Hiro Stacks API, Blockstream, CoinGecko
- **Testing**: Vitest (Clarinet)
- **Development**: Clarinet, Node.js

## Roadmap

- [x] 10 Smart contracts
- [x] Real-time monitoring dashboard
- [x] sBTC peg-in/peg-out tracking
- [x] Volume analytics
- [x] DeFi protocol tracking
- [ ] Mainnet deployment
- [ ] Contract auditing
- [ ] Ethereum bridge integration
- [ ] Mobile app
- [ ] Telegram/Discord bots
- [ ] Subgraph indexer

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License
