# Stacks Bridge Monitor

Real-time monitoring and analytics for cross-chain bridges on the Stacks blockchain. Track sBTC, wrapped assets, and bridge transactions across Bitcoin, Ethereum, and Stacks.

## Features

- **Real-time Bridge Tracking**: Monitor sBTC peg-ins and peg-outs
- **Multi-chain Support**: Bitcoin, Ethereum, Stacks bridges
- **Volume Analytics**: Daily, weekly, monthly bridge volumes
- **Fee Analysis**: Track bridge fees and gas costs
- **Alert System**: Notifications for large transfers
- **Historical Data**: Complete bridge transaction history

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Stacks Bridge Monitor                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Bitcoin   │  │  Ethereum   │  │       Stacks        │  │
│  │   Bridge    │  │   Bridge    │  │       Network       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │    Event Processor    │                       │
│              │    (Chainhooks)       │                       │
│              └───────────┬───────────┘                       │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │   Analytics Engine    │                       │
│              │   - Volume tracking   │                       │
│              │   - Fee analysis      │                       │
│              │   - Alert system      │                       │
│              └───────────────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Supported Bridges

### sBTC (Bitcoin <-> Stacks)
- Peg-in: BTC -> sBTC
- Peg-out: sBTC -> BTC
- Threshold signatures
- Deposit tracking

### Wrapped Assets
- wBTC on Stacks
- USDC bridges
- Cross-chain tokens

## Quick Start

### Installation

```bash
git clone https://github.com/serayd61/stacks-bridge-monitor.git
cd stacks-bridge-monitor
npm install
```

### Configuration

Create `.env` file:

```env
STACKS_API_URL=https://api.hiro.so
BITCOIN_API_URL=https://blockstream.info/api
DATABASE_URL=postgresql://localhost:5432/bridge_monitor
ALERT_WEBHOOK_URL=https://your-webhook.com
```

### Run

```bash
# Start the monitor
npm run start

# Development mode
npm run dev

# Run tests
npm test
```

## API Endpoints

### Bridge Statistics
```
GET /api/bridges/stats
GET /api/bridges/volume?period=24h
GET /api/bridges/fees
```

### sBTC Tracking
```
GET /api/sbtc/peg-ins
GET /api/sbtc/peg-outs
GET /api/sbtc/supply
```

### Transactions
```
GET /api/transactions?bridge=sbtc&limit=100
GET /api/transactions/:txid
```

## Data Models

### Bridge Transaction
```typescript
interface BridgeTransaction {
  id: string;
  bridge: 'sbtc' | 'wbtc' | 'usdc';
  type: 'peg-in' | 'peg-out';
  sourceChain: string;
  destChain: string;
  amount: bigint;
  fee: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  sourceTxId: string;
  destTxId: string;
  timestamp: Date;
}
```

### Bridge Stats
```typescript
interface BridgeStats {
  totalVolume24h: bigint;
  totalVolume7d: bigint;
  totalTransactions: number;
  avgFee: bigint;
  largestTransaction: bigint;
  activeUsers: number;
}
```

## Alerts

Configure alerts for:
- Large transfers (> threshold)
- Unusual volume spikes
- Bridge delays
- Failed transactions

```typescript
const alertConfig = {
  largeTransferThreshold: 10_000_000, // 10 BTC in sats
  volumeSpikeMultiplier: 3,
  delayThresholdMinutes: 60
};
```

## Roadmap

- [x] sBTC peg-in/peg-out tracking
- [x] Volume analytics
- [x] Basic alerting
- [ ] Ethereum bridge support
- [ ] Historical charts
- [ ] Mobile app
- [ ] Telegram/Discord bots
- [ ] API rate limiting

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## License

MIT License
