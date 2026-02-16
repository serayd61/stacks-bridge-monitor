/**
 * Stacks Bridge Monitor
 * Real-time monitoring for cross-chain bridges
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';

// Types
export interface BridgeTransaction {
  id: string;
  bridge: 'sbtc' | 'wbtc' | 'usdc';
  type: 'peg-in' | 'peg-out';
  sourceChain: string;
  destChain: string;
  amount: bigint;
  fee: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  sourceTxId: string;
  destTxId: string | null;
  timestamp: Date;
}

export interface BridgeStats {
  totalVolume24h: bigint;
  totalVolume7d: bigint;
  totalTransactions: number;
  avgFee: bigint;
  largestTransaction: bigint;
  activeUsers: number;
}

export interface SBTCSupply {
  totalSupply: bigint;
  circulatingSupply: bigint;
  lockedBTC: bigint;
  pendingPegIns: number;
  pendingPegOuts: number;
}

// Configuration
const config = {
  stacksApiUrl: process.env.STACKS_API_URL || 'https://api.hiro.so',
  bitcoinApiUrl: process.env.BITCOIN_API_URL || 'https://blockstream.info/api',
  port: parseInt(process.env.PORT || '3000'),
  alertThreshold: BigInt(process.env.ALERT_THRESHOLD || '1000000000'), // 10 BTC
};

// In-memory storage (would use database in production)
const transactions: BridgeTransaction[] = [];
const stats: BridgeStats = {
  totalVolume24h: BigInt(0),
  totalVolume7d: BigInt(0),
  totalTransactions: 0,
  avgFee: BigInt(0),
  largestTransaction: BigInt(0),
  activeUsers: 0,
};

// Fastify server
const app = Fastify({ logger: true });

// Middleware
app.register(cors, { origin: true });

// Routes
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/bridges/stats', async () => ({
  totalVolume24h: stats.totalVolume24h.toString(),
  totalVolume7d: stats.totalVolume7d.toString(),
  totalTransactions: stats.totalTransactions,
  avgFee: stats.avgFee.toString(),
  largestTransaction: stats.largestTransaction.toString(),
  activeUsers: stats.activeUsers,
}));

app.get('/api/bridges/volume', async (request) => {
  const { period = '24h' } = request.query as { period?: string };
  const now = Date.now();
  const periodMs = period === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  
  const filtered = transactions.filter(
    tx => now - tx.timestamp.getTime() < periodMs
  );
  
  const volume = filtered.reduce((sum, tx) => sum + tx.amount, BigInt(0));
  
  return {
    period,
    volume: volume.toString(),
    count: filtered.length,
  };
});

app.get('/api/sbtc/supply', async () => {
  // Fetch from Stacks API
  try {
    const response = await fetch(`${config.stacksApiUrl}/extended/v1/tokens/ft/metadata`);
    // Simplified - would parse actual sBTC data
    return {
      totalSupply: '0',
      circulatingSupply: '0',
      lockedBTC: '0',
      pendingPegIns: 0,
      pendingPegOuts: 0,
    };
  } catch (error) {
    return { error: 'Failed to fetch sBTC supply' };
  }
});

app.get('/api/sbtc/peg-ins', async (request) => {
  const { limit = 50 } = request.query as { limit?: number };
  return transactions
    .filter(tx => tx.bridge === 'sbtc' && tx.type === 'peg-in')
    .slice(0, limit)
    .map(tx => ({
      ...tx,
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
    }));
});

app.get('/api/sbtc/peg-outs', async (request) => {
  const { limit = 50 } = request.query as { limit?: number };
  return transactions
    .filter(tx => tx.bridge === 'sbtc' && tx.type === 'peg-out')
    .slice(0, limit)
    .map(tx => ({
      ...tx,
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
    }));
});

app.get('/api/transactions', async (request) => {
  const { bridge, limit = 100, offset = 0 } = request.query as {
    bridge?: string;
    limit?: number;
    offset?: number;
  };
  
  let filtered = transactions;
  if (bridge) {
    filtered = filtered.filter(tx => tx.bridge === bridge);
  }
  
  return filtered
    .slice(offset, offset + limit)
    .map(tx => ({
      ...tx,
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
    }));
});

app.get('/api/transactions/:txid', async (request) => {
  const { txid } = request.params as { txid: string };
  const tx = transactions.find(t => t.sourceTxId === txid || t.destTxId === txid);
  
  if (!tx) {
    return { error: 'Transaction not found' };
  }
  
  return {
    ...tx,
    amount: tx.amount.toString(),
    fee: tx.fee.toString(),
  };
});

// Webhook endpoint for Chainhooks
app.post('/api/webhook/chainhook', async (request) => {
  const payload = request.body as any;
  
  // Process chainhook event
  console.log('Received chainhook event:', payload);
  
  // Would parse and store transaction here
  
  return { received: true };
});

// Alert check
function checkAlerts(tx: BridgeTransaction): void {
  if (tx.amount > config.alertThreshold) {
    console.log(`🚨 Large transfer alert: ${tx.amount} on ${tx.bridge}`);
    // Would send webhook/notification here
  }
}

// Start server (only when not in serverless)
async function start(): Promise<void> {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Bridge Monitor running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Only start if running directly (not serverless)
if (process.env.VERCEL !== '1') {
  start();
}

// Export for Vercel serverless
export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit('request', req, res);
}

export { app, config };
