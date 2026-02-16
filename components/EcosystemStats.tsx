'use client';

import { 
  Blocks, 
  Users, 
  FileCode, 
  Activity,
  Zap,
  Clock
} from 'lucide-react';

interface EcosystemStatsProps {
  stats: {
    blockHeight: number;
    totalTransactions: number;
    totalAccounts: number;
    totalContracts: number;
    avgBlockTime: number;
    tps: number;
  };
}

export default function EcosystemStats({ stats }: EcosystemStatsProps) {
  const items = [
    {
      label: 'Block Height',
      value: stats.blockHeight.toLocaleString(),
      icon: Blocks,
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
    },
    {
      label: 'Total Transactions',
      value: `${(stats.totalTransactions / 1e6).toFixed(1)}M`,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
    },
    {
      label: 'Total Accounts',
      value: `${(stats.totalAccounts / 1e6).toFixed(2)}M`,
      icon: Users,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
    },
    {
      label: 'Smart Contracts',
      value: stats.totalContracts.toLocaleString(),
      icon: FileCode,
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
    },
    {
      label: 'Avg Block Time',
      value: `~${stats.avgBlockTime} min`,
      icon: Clock,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
    },
    {
      label: 'Peak TPS',
      value: stats.tps.toString(),
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition-all hover:border-gray-700"
        >
          <div className={`inline-flex p-2 rounded-lg ${item.bg} mb-3`}>
            <item.icon className={`h-5 w-5 ${item.color}`} />
          </div>
          <p className="text-2xl font-bold text-white">{item.value}</p>
          <p className="text-xs text-gray-400 mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
