// API utilities for fetching bridge data

const STACKS_API = 'https://api.hiro.so';
const BITCOIN_API = 'https://blockstream.info/api';

export interface BridgeStats {
  totalVolume24h: string;
  totalVolume7d: string;
  totalTransactions: number;
  avgFee: string;
  largestTransaction: string;
  activeUsers: number;
  pegInCount: number;
  pegOutCount: number;
}

export interface SBTCData {
  totalSupply: string;
  circulatingSupply: string;
  btcPrice: number;
  sbtcPrice: number;
  holders: number;
}

export interface RecentTransaction {
  txId: string;
  type: 'peg-in' | 'peg-out';
  amount: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  btcAddress?: string;
  stacksAddress?: string;
}

// Fetch STX price from CoinGecko
export async function fetchSTXPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd',
      { next: { revalidate: 60 } }
    );
    const data = await response.json();
    return data.blockstack?.usd || 0;
  } catch {
    return 0;
  }
}

// Fetch BTC price from CoinGecko
export async function fetchBTCPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { next: { revalidate: 60 } }
    );
    const data = await response.json();
    return data.bitcoin?.usd || 0;
  } catch {
    return 0;
  }
}

// Fetch recent Stacks blocks
export async function fetchRecentBlocks(): Promise<any[]> {
  try {
    const response = await fetch(
      `${STACKS_API}/extended/v2/blocks?limit=5`,
      { next: { revalidate: 30 } }
    );
    const data = await response.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// Fetch mempool stats
export async function fetchMempoolStats(): Promise<any> {
  try {
    const response = await fetch(
      `${STACKS_API}/extended/v1/tx/mempool/stats`,
      { next: { revalidate: 30 } }
    );
    return await response.json();
  } catch {
    return { tx_count: 0 };
  }
}

// Fetch Bitcoin mempool
export async function fetchBitcoinMempool(): Promise<any> {
  try {
    const response = await fetch(
      `${BITCOIN_API}/mempool`,
      { next: { revalidate: 60 } }
    );
    return await response.json();
  } catch {
    return { count: 0, vsize: 0 };
  }
}

// Mock sBTC data (would be real API in production)
export async function fetchSBTCStats(): Promise<SBTCData> {
  const btcPrice = await fetchBTCPrice();
  
  return {
    totalSupply: '1,247.83',
    circulatingSupply: '1,198.45',
    btcPrice,
    sbtcPrice: btcPrice * 0.9998, // Slight discount
    holders: 3847,
  };
}

// Mock bridge stats
export async function fetchBridgeStats(): Promise<BridgeStats> {
  return {
    totalVolume24h: '127.45',
    totalVolume7d: '892.31',
    totalTransactions: 1847,
    avgFee: '0.00012',
    largestTransaction: '25.00',
    activeUsers: 423,
    pegInCount: 1203,
    pegOutCount: 644,
  };
}

// Mock recent transactions
export async function fetchRecentTransactions(): Promise<RecentTransaction[]> {
  return [
    {
      txId: '0x8a7f...3e2d',
      type: 'peg-in',
      amount: '2.5',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      btcAddress: 'bc1q...xyz',
      stacksAddress: 'SP2PE...WJB',
    },
    {
      txId: '0x4b2c...9f1a',
      type: 'peg-out',
      amount: '1.25',
      status: 'pending',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      btcAddress: 'bc1q...abc',
      stacksAddress: 'SP3K8...KBR9',
    },
    {
      txId: '0x6d3e...7c4b',
      type: 'peg-in',
      amount: '5.0',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      btcAddress: 'bc1q...def',
      stacksAddress: 'SP1H1...4C7R',
    },
    {
      txId: '0x2f8a...1d5c',
      type: 'peg-out',
      amount: '0.75',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      btcAddress: 'bc1q...ghi',
      stacksAddress: 'SPNWZ...VQ0S',
    },
    {
      txId: '0x9c1d...4e2f',
      type: 'peg-in',
      amount: '10.0',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      btcAddress: 'bc1q...jkl',
      stacksAddress: 'SP3FB...SVTE',
    },
  ];
}

export function formatBTC(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
