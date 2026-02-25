import { Layers, Github, Heart } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import TransactionTable from '@/components/TransactionTable';
import PriceChart from '@/components/PriceChart';
import NetworkStatus from '@/components/NetworkStatus';
import TokenTable from '@/components/TokenTable';
import DeFiProtocols from '@/components/DeFiProtocols';
import NFTCollections from '@/components/NFTCollections';
import EcosystemStats from '@/components/EcosystemStats';
import PriceHeader from '@/components/PriceHeader';
import QuickLinks from '@/components/QuickLinks';
import ContractEcosystem from '@/components/ContractEcosystem';
import {
  fetchBridgeStats,
  fetchSBTCStats,
  fetchRecentTransactions,
  fetchRecentBlocks,
  fetchMempoolStats,
  fetchBitcoinMempool,
  fetchSTXData,
  fetchStacksStats,
  fetchDeFiProtocols,
  fetchNFTCollections,
  fetchTopTokens,
} from '@/lib/api';

export const revalidate = 30;

export default async function Home() {
  const [
    bridgeStats,
    sbtcStats,
    transactions,
    blocks,
    mempoolStats,
    btcMempool,
    stxData,
    stacksStats,
    defiProtocols,
    nftCollections,
    topTokens,
  ] = await Promise.all([
    fetchBridgeStats(),
    fetchSBTCStats(),
    fetchRecentTransactions(),
    fetchRecentBlocks(),
    fetchMempoolStats(),
    fetchBitcoinMempool(),
    fetchSTXData(),
    fetchStacksStats(),
    fetchDeFiProtocols(),
    fetchNFTCollections(),
    fetchTopTokens(),
  ]);

  return (
    <main className="min-h-screen">
      {/* Price Ticker */}
      <PriceHeader stxData={stxData} btcPrice={sbtcStats.btcPrice} />

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 shadow-lg shadow-purple-500/20">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Stacks Dashboard</h1>
                <p className="text-xs text-gray-400">Ecosystem Analytics & sBTC Monitor</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Mainnet Live</span>
              </div>
              <a
                href="https://github.com/serayd61/stacks-bridge-monitor"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Github className="h-4 w-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <span className="text-purple-400 text-sm font-medium">Powered by Bitcoin</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              The Complete Stacks
              <span className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent"> Dashboard</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Real-time analytics for the Stacks ecosystem. Track sBTC, DeFi protocols, 
              NFTs, and network health — all in one place.
            </p>
          </div>
          
          {/* Ecosystem Stats */}
          <EcosystemStats stats={stacksStats} />
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* sBTC Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <span className="text-orange-400 font-bold text-sm">₿</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">sBTC Bridge</h2>
              <p className="text-sm text-gray-400">Bitcoin on Stacks</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="sBTC Supply"
              value={sbtcStats.totalSupply}
              subtitle={`${sbtcStats.holders.toLocaleString()} holders`}
              iconName="arrow-down-left"
              color="orange"
            />
            <StatsCard
              title="24h Peg-Ins"
              value={`${bridgeStats.totalVolume24h} BTC`}
              subtitle={`${bridgeStats.pegInCount} transactions`}
              iconName="arrow-down-left"
              trend={{ value: 12.5, isPositive: true }}
              color="green"
            />
            <StatsCard
              title="24h Peg-Outs"
              value={`${(parseFloat(bridgeStats.totalVolume24h) * 0.4).toFixed(2)} BTC`}
              subtitle={`${bridgeStats.pegOutCount} transactions`}
              iconName="arrow-up-right"
              trend={{ value: 8.3, isPositive: true }}
              color="purple"
            />
            <StatsCard
              title="Active Users"
              value={bridgeStats.activeUsers.toString()}
              subtitle="Unique addresses"
              iconName="users"
              trend={{ value: 5.2, isPositive: true }}
              color="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PriceChart
                btcPrice={sbtcStats.btcPrice}
                sbtcPrice={sbtcStats.sbtcPrice}
              />
            </div>
            <div>
              <NetworkStatus
                stacksBlocks={blocks}
                mempoolStats={mempoolStats}
                btcMempool={btcMempool}
              />
            </div>
          </div>
        </section>

        {/* Tokens Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-400 font-bold text-sm">$</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tokens</h2>
              <p className="text-sm text-gray-400">Top tokens by market cap</p>
            </div>
          </div>
          <TokenTable tokens={topTokens} />
        </section>

        {/* Smart Contract Ecosystem */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 font-bold text-sm">16</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Smart Contract Ecosystem</h2>
              <p className="text-sm text-gray-400">16 Clarity contracts powering the bridge</p>
            </div>
          </div>
          <ContractEcosystem />
        </section>

        {/* DeFi & NFT Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DeFiProtocols protocols={defiProtocols} />
          </div>
          <div>
            <NFTCollections collections={nftCollections} />
          </div>
        </section>

        {/* Recent Transactions & Quick Links */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TransactionTable transactions={transactions} />
          </div>
          <div>
            <QuickLinks />
          </div>
        </section>

        {/* Donate Section */}
        <section className="rounded-xl border border-gray-800 bg-gradient-to-br from-purple-500/10 via-gray-900/50 to-orange-500/10 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 mb-4">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Support This Project</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Help us keep building open-source tools for the Stacks ecosystem. 
              Every contribution helps!
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* BTC Donation */}
            <div className="rounded-xl bg-gray-800/50 border border-orange-500/30 p-5 hover:border-orange-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 font-bold">₿</span>
                </div>
                <div>
                  <span className="font-semibold text-white">Bitcoin</span>
                  <p className="text-xs text-gray-400">Native BTC</p>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <code className="text-sm text-orange-400 break-all select-all font-mono">
                  bc1q8jrgvvmu8ufjaqd47mrjpc8yr3x2rfhgkt9lx7
                </code>
              </div>
            </div>
            
            {/* STX Donation */}
            <div className="rounded-xl bg-gray-800/50 border border-purple-500/30 p-5 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 font-bold">STX</span>
                </div>
                <div>
                  <span className="font-semibold text-white">Stacks</span>
                  <p className="text-xs text-gray-400">STX Token</p>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <code className="text-sm text-purple-400 break-all select-all font-mono">
                  SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 pt-8 pb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-semibold text-white">Stacks Dashboard</span>
                <p className="text-xs text-gray-500">Built with ❤️ for the Stacks community</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <a href="https://explorer.hiro.so" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                Explorer
              </a>
              <a href="https://docs.stacks.co" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                Docs
              </a>
              <a href="https://stacks.co" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                Stacks.co
              </a>
              <a href="https://github.com/serayd61/stacks-bridge-monitor" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                GitHub
              </a>
            </div>
            
            <div className="text-sm text-gray-500">
              © 2024 Stacks Dashboard
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
