'use client';

import { Bitcoin, TrendingUp, TrendingDown } from 'lucide-react';

interface PriceChartProps {
  btcPrice: number;
  sbtcPrice: number;
}

export default function PriceChart({ btcPrice, sbtcPrice }: PriceChartProps) {
  const peg = sbtcPrice / btcPrice;
  const pegPercentage = ((peg - 1) * 100).toFixed(3);
  const isPegPositive = peg >= 1;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">sBTC/BTC Peg</h3>
          <p className="text-sm text-gray-400">Real-time price tracking</p>
        </div>
        <div className="rounded-lg bg-orange-500/20 p-3">
          <Bitcoin className="h-6 w-6 text-orange-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* BTC Price */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="text-sm text-gray-400">Bitcoin</span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* sBTC Price */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-purple-400" />
            <span className="text-sm text-gray-400">sBTC</span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${sbtcPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Peg Status */}
      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Peg Ratio</p>
            <p className="text-xl font-bold text-white">{peg.toFixed(6)}</p>
          </div>
          <div className={`flex items-center gap-1 ${isPegPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPegPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <span className="font-medium">{pegPercentage}%</span>
          </div>
        </div>
        
        {/* Visual peg indicator */}
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-gray-700">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                peg >= 0.999 ? 'bg-green-500' : peg >= 0.99 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(peg * 100, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>0.99</span>
            <span>1.00</span>
            <span>1.01</span>
          </div>
        </div>
      </div>
    </div>
  );
}
