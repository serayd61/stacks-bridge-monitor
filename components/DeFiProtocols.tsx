'use client';

import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface Protocol {
  name: string;
  tvl: string;
  change24h: number;
  category: string;
  logo: string;
}

interface DeFiProtocolsProps {
  protocols: Protocol[];
}

export default function DeFiProtocols({ protocols }: DeFiProtocolsProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">DeFi Protocols</h3>
          <p className="text-sm text-gray-400">Top protocols by TVL</p>
        </div>
        <span className="text-xs text-gray-500">Total TVL: $270M+</span>
      </div>

      <div className="space-y-3">
        {protocols.map((protocol, index) => (
          <div
            key={protocol.name}
            className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4 transition-all hover:bg-gray-800 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-700 text-xl">
                {protocol.logo}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{protocol.name}</p>
                  <ExternalLink className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-gray-400">{protocol.category}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-medium text-white">{protocol.tvl}</p>
              <span className={`text-xs ${
                protocol.change24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {protocol.change24h >= 0 ? '+' : ''}{protocol.change24h}%
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <a
        href="https://defillama.com/chain/Stacks"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
      >
        View all on DefiLlama →
      </a>
    </div>
  );
}
