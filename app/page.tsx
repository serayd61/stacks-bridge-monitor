import { Layers } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import TransactionTable from '@/components/TransactionTable';
import PriceChart from '@/components/PriceChart';
import NetworkStatus from '@/components/NetworkStatus';
import {
  fetchBridgeStats,
  fetchSBTCStats,
  fetchRecentTransactions,
  fetchRecentBlocks,
  fetchMempoolStats,
  fetchBitcoinMempool,
} from '@/lib/api';

export const revalidate = 30; // Revalidate every 30 seconds

export default async function Home() {
  // Fetch all data in parallel
  const [bridgeStats, sbtcStats, transactions, blocks, mempoolStats, btcMempool] =
    await Promise.all([
      fetchBridgeStats(),
      fetchSBTCStats(),
      fetchRecentTransactions(),
      fetchRecentBlocks(),
      fetchMempoolStats(),
      fetchBitcoinMempool(),
    ]);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-orange-500">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Bridge Monitor</h1>
                <p className="text-xs text-gray-400">sBTC & Cross-Chain Analytics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-400">Live</span>
              </div>
              <a
                href="https://github.com/serayd61/stacks-bridge-monitor"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-orange-500/10" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Real-Time Bridge Analytics
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Monitor sBTC peg-ins, peg-outs, and cross-chain bridge activity on the Stacks blockchain.
              Track volumes, fees, and network health in real-time.
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-white">{bridgeStats.totalVolume24h} BTC</p>
              <p className="text-sm text-gray-400">24h Volume</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-white">{bridgeStats.totalTransactions.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Total Transactions</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-white">{sbtcStats.totalSupply}</p>
              <p className="text-sm text-gray-400">sBTC Supply</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-white">{sbtcStats.holders.toLocaleString()}</p>
              <p className="text-sm text-gray-400">sBTC Holders</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Peg-In Volume (24h)"
            value={`${bridgeStats.totalVolume24h} BTC`}
            subtitle={`${bridgeStats.pegInCount} transactions`}
            iconName="arrow-down-left"
            trend={{ value: 12.5, isPositive: true }}
            color="green"
          />
          <StatsCard
            title="Peg-Out Volume (24h)"
            value={`${(parseFloat(bridgeStats.totalVolume24h) * 0.4).toFixed(2)} BTC`}
            subtitle={`${bridgeStats.pegOutCount} transactions`}
            iconName="arrow-up-right"
            trend={{ value: 8.3, isPositive: true }}
            color="orange"
          />
          <StatsCard
            title="Active Users"
            value={bridgeStats.activeUsers.toString()}
            subtitle="Unique addresses"
            iconName="users"
            trend={{ value: 5.2, isPositive: true }}
            color="purple"
          />
          <StatsCard
            title="Average Fee"
            value={`${bridgeStats.avgFee} BTC`}
            subtitle="Per transaction"
            iconName="activity"
            trend={{ value: -2.1, isPositive: false }}
            color="blue"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Price Chart - 2 columns */}
          <div className="lg:col-span-2">
            <PriceChart
              btcPrice={sbtcStats.btcPrice}
              sbtcPrice={sbtcStats.sbtcPrice}
            />
          </div>
          
          {/* Network Status - 1 column */}
          <div>
            <NetworkStatus
              stacksBlocks={blocks}
              mempoolStats={mempoolStats}
              btcMempool={btcMempool}
            />
          </div>
        </div>

        {/* Transaction Table */}
        <TransactionTable transactions={transactions} />

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-800 pt-8 pb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-orange-500">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-400">Stacks Bridge Monitor</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="https://github.com/serayd61/stacks-bridge-monitor" className="hover:text-white transition-colors">
                GitHub
              </a>
              <a href="https://docs.stacks.co" className="hover:text-white transition-colors">
                Stacks Docs
              </a>
              <a href="https://explorer.hiro.so" className="hover:text-white transition-colors">
                Explorer
              </a>
            </div>
            <p className="text-sm text-gray-500">
              Built for the Stacks ecosystem
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
