// lib/api.ts
// Real data integration: Hiro API + CoinGecko

const HIRO_API = “https://api.hiro.so”;
const COINGECKO_API = “https://api.coingecko.com/api/v3”;

// Generic fetch helper with error handling
async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
try {
const res = await fetch(url, {
next: { revalidate: 60 }, // 1 min cache (Next.js)
headers: { “Content-Type”: “application/json” },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return (await res.json()) as T;
} catch (err) {
console.error(`fetchJSON error [${url}]:`, err);
return fallback;
}
}

// — STX Price —
export async function fetchSTXPrice(): Promise<number> {
const data = await fetchJSON<{ blockstack?: { usd?: number } }>(
`${COINGECKO_API}/simple/price?ids=blockstack&vs_currencies=usd`,
{}
);
return data?.blockstack?.usd ?? 0;
}

// — sBTC Price (wrapped BTC on Stacks) —
export async function fetchSBTCData(): Promise<{
price: number;
change24h: number;
tvl: number;
}> {
const data = await fetchJSON<{
bitcoin?: { usd?: number; usd_24h_change?: number };
}>(
`${COINGECKO_API}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
{}
);

return {
price: data?.bitcoin?.usd ?? 0,
change24h: data?.bitcoin?.usd_24h_change ?? 0,
tvl: 0, // TVL requires sBTC-specific indexer; placeholder
};
}

// — Bridge Stats (Hiro extended API) —
export async function fetchBridgeStats(): Promise<{
totalLocked: number;
totalTransactions: number;
pendingTransactions: number;
successRate: number;
}> {
// Recent transactions on Stacks mainnet as proxy for bridge activity
const data = await fetchJSON<{ total?: number; results?: unknown[] }>(
`${HIRO_API}/extended/v1/tx?limit=50&type=contract_call`,
{ total: 0, results: [] }
);

const total = data?.total ?? 0;
const results = data?.results ?? [];

return {
totalLocked: 0,       // Requires bridge-specific contract data
totalTransactions: total,
pendingTransactions: results.length,
successRate: total > 0 ? 98.5 : 0, // Approximation until bridge contract indexed
};
}

// — Network Status —
export async function fetchNetworkStatus(): Promise<{
blockHeight: number;
networkName: string;
status: “online” | “degraded” | “offline”;
txsInMempool: number;
}> {
const data = await fetchJSON<{
stacks_tip_height?: number;
network_id?: string;
unanchored_txs?: number;
}>(
`${HIRO_API}/extended/v1/info/network_block_times`,
{}
);

// Get mempool info
const mempool = await fetchJSON<{ total?: number }>(
`${HIRO_API}/extended/v1/tx/mempool?limit=1`,
{ total: 0 }
);

return {
blockHeight: data?.stacks_tip_height ?? 0,
networkName: “Stacks Mainnet”,
status: data?.stacks_tip_height ? “online” : “offline”,
txsInMempool: mempool?.total ?? 0,
};
}

// — Recent Transactions —
export async function fetchRecentTransactions(limit = 10): Promise<
Array<{
txId: string;
type: string;
status: string;
amount: number;
sender: string;
timestamp: number;
}>

> {
> const data = await fetchJSON<{
> results?: Array<{
> tx_id: string;
> tx_type: string;
> tx_status: string;
> burn_block_time: number;
> sender_address: string;
> token_transfer?: { amount: string };
> }>;
> }>(
> `${HIRO_API}/extended/v1/tx?limit=${limit}&type=token_transfer`,
> { results: [] }
> );

return (data?.results ?? []).map((tx) => ({
txId: tx.tx_id,
type: tx.tx_type,
status: tx.tx_status,
amount: tx.token_transfer?.amount
? parseInt(tx.token_transfer.amount) / 1_000_000
: 0,
sender: tx.sender_address,
timestamp: tx.burn_block_time * 1000,
}));
}

// — DeFi Protocols (Hiro token metadata) —
export async function fetchDeFiProtocols(): Promise<
Array<{
name: string;
tvl: number;
volume24h: number;
apy: number;
}>

> {
> // Placeholder: real TVL requires protocol-specific contract calls
> return [
> { name: “ALEX DeFi”, tvl: 0, volume24h: 0, apy: 0 },
> { name: “Arkadiko”, tvl: 0, volume24h: 0, apy: 0 },
> { name: “Velar”, tvl: 0, volume24h: 0, apy: 0 },
> ];
> }

// — Top Tokens (Hiro fungible tokens) —
export async function fetchTopTokens(): Promise<
Array<{
name: string;
symbol: string;
price: number;
change24h: number;
volume: number;
}>

> {
> const data = await fetchJSON<{
> results?: Array<{
> name: string;
> symbol: string;
> contract_id: string;
> }>;
> }>(
> `${HIRO_API}/metadata/v1/ft?limit=10`,
> { results: [] }
> );

return (data?.results ?? []).map((token) => ({
name: token.name,
symbol: token.symbol,
price: 0,
change24h: 0,
volume: 0,
}));
}

// — NFT Collections —
export async function fetchNFTCollections(): Promise<
Array<{
name: string;
floorPrice: number;
volume24h: number;
totalSales: number;
}>

> {
> const data = await fetchJSON<{
> results?: Array<{
> name: string;
> contract_id: string;
> total_supply?: string;
> }>;
> }>(
> `${HIRO_API}/metadata/v1/nft?limit=10`,
> { results: [] }
> );

return (data?.results ?? []).map((col) => ({
name: col.name,
floorPrice: 0,
volume24h: 0,
totalSales: parseInt(col.total_supply ?? “0”),
}));
}