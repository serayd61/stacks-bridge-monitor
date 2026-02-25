'use client';

import { Shield, Zap, TrendingUp, Users, Clock, Gift, Layers, Lock, Vote, Coins, BarChart3, Eye } from 'lucide-react';

interface ContractInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
  stats: { label: string; value: string }[];
  color: string;
  tag: string;
}

const contracts: ContractInfo[] = [
  {
    name: 'Flash Loan',
    description: 'Uncollateralized instant loans for DeFi arbitrage and liquidations',
    icon: <Zap className="h-5 w-5" />,
    stats: [
      { label: 'Fee', value: '0.09%' },
      { label: 'Pools', value: 'Multi' },
    ],
    color: 'from-yellow-500 to-orange-500',
    tag: 'DeFi',
  },
  {
    name: 'Insurance Pool',
    description: 'Coverage for bridge operations against smart contract failures',
    icon: <Shield className="h-5 w-5" />,
    stats: [
      { label: 'Types', value: '4' },
      { label: 'Premium', value: '2%' },
    ],
    color: 'from-blue-500 to-cyan-500',
    tag: 'Security',
  },
  {
    name: 'Yield Farming',
    description: 'Multi-pool farming rewards with boost tiers and bonus periods',
    icon: <TrendingUp className="h-5 w-5" />,
    stats: [
      { label: 'Max Boost', value: '3x' },
      { label: 'Farms', value: '20 max' },
    ],
    color: 'from-green-500 to-emerald-500',
    tag: 'DeFi',
  },
  {
    name: 'Bridge Validator',
    description: 'Decentralized validator network securing cross-chain operations',
    icon: <Eye className="h-5 w-5" />,
    stats: [
      { label: 'Max', value: '50' },
      { label: 'Confirmations', value: '3' },
    ],
    color: 'from-purple-500 to-violet-500',
    tag: 'Infrastructure',
  },
  {
    name: 'Token Vesting',
    description: 'Linear & cliff vesting schedules with milestone-based releases',
    icon: <Clock className="h-5 w-5" />,
    stats: [
      { label: 'Types', value: '3' },
      { label: 'Categories', value: '5' },
    ],
    color: 'from-pink-500 to-rose-500',
    tag: 'Tokenomics',
  },
  {
    name: 'Referral System',
    description: 'Multi-tier referral program with campaigns and leaderboards',
    icon: <Gift className="h-5 w-5" />,
    stats: [
      { label: 'Levels', value: '3' },
      { label: 'Base Rate', value: '3%' },
    ],
    color: 'from-indigo-500 to-blue-500',
    tag: 'Growth',
  },
];

const existingContracts = [
  { name: 'Bridge Token', tag: 'SIP-010', icon: <Coins className="h-4 w-4" /> },
  { name: 'Bridge Registry', tag: 'Core', icon: <Layers className="h-4 w-4" /> },
  { name: 'Fee Manager', tag: 'Finance', icon: <BarChart3 className="h-4 w-4" /> },
  { name: 'Governance DAO', tag: 'Governance', icon: <Vote className="h-4 w-4" /> },
  { name: 'Staking Vault', tag: 'DeFi', icon: <Lock className="h-4 w-4" /> },
  { name: 'Liquidity Pool', tag: 'AMM', icon: <TrendingUp className="h-4 w-4" /> },
  { name: 'Oracle', tag: 'Data', icon: <Eye className="h-4 w-4" /> },
  { name: 'Multisig Treasury', tag: 'Security', icon: <Shield className="h-4 w-4" /> },
  { name: 'NFT Rewards', tag: 'SIP-009', icon: <Gift className="h-4 w-4" /> },
  { name: 'Timelock Controller', tag: 'Security', icon: <Clock className="h-4 w-4" /> },
];

export default function ContractEcosystem() {
  return (
    <div className="space-y-6">
      {/* New Contracts Showcase */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">New Smart Contracts</h3>
            <p className="text-sm text-gray-400">6 new contracts added to the ecosystem</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium">
            +6 Contracts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contracts.map((contract) => (
            <div
              key={contract.name}
              className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 hover:bg-gray-800/60 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br ${contract.color} text-white shadow-lg`}>
                  {contract.icon}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-gray-700/50 text-xs text-gray-400">
                  {contract.tag}
                </span>
              </div>
              <h4 className="font-semibold text-white mb-1">{contract.name}</h4>
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{contract.description}</p>
              <div className="flex gap-3">
                {contract.stats.map((stat) => (
                  <div key={stat.label} className="flex-1 rounded bg-gray-900/50 px-2 py-1.5 text-center">
                    <p className="text-xs text-gray-500">{stat.label}</p>
                    <p className="text-sm font-medium text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Existing Contracts Grid */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Core Contracts</h3>
            <p className="text-sm text-gray-400">10 foundational smart contracts</p>
          </div>
          <span className="text-sm font-medium text-purple-400">16 Total</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {existingContracts.map((contract) => (
            <div
              key={contract.name}
              className="flex items-center gap-2 rounded-lg bg-gray-800/40 px-3 py-2.5 hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-400">{contract.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{contract.name}</p>
                <p className="text-[10px] text-gray-500">{contract.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
