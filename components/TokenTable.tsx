'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface Token {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: string;
  marketCap: string;
}

interface TokenTableProps {
  tokens: Token[];
}

export default function TokenTable({ tokens }: TokenTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="border-b border-gray-800 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Top Tokens</h3>
        <p className="text-sm text-gray-400">Stacks ecosystem tokens by market cap</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
              <th className="px-6 py-3 font-medium">#</th>
              <th className="px-6 py-3 font-medium">Token</th>
              <th className="px-6 py-3 font-medium text-right">Price</th>
              <th className="px-6 py-3 font-medium text-right">24h</th>
              <th className="px-6 py-3 font-medium text-right">Volume</th>
              <th className="px-6 py-3 font-medium text-right">Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, index) => (
              <tr
                key={token.symbol}
                className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
              >
                <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{token.symbol}</p>
                      <p className="text-xs text-gray-400">{token.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-mono text-white">
                  ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center gap-1 ${
                    token.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {token.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(token.change24h).toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-gray-300">${token.volume}</td>
                <td className="px-6 py-4 text-right text-gray-300">${token.marketCap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
