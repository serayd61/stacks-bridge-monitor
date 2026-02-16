'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceHeaderProps {
  stxData: {
    price: number;
    priceChange24h: number;
    marketCap: number;
    volume24h: number;
  };
  btcPrice: number;
}

export default function PriceHeader({ stxData, btcPrice }: PriceHeaderProps) {
  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-6 py-3 px-4 bg-gray-900/50 border-b border-gray-800 text-sm">
      {/* STX Price */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">STX</span>
        </div>
        <span className="font-medium text-white">${stxData.price.toFixed(2)}</span>
        <span className={`flex items-center gap-0.5 text-xs ${
          stxData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
        }`}>
          {stxData.priceChange24h >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {Math.abs(stxData.priceChange24h).toFixed(1)}%
        </span>
      </div>

      <div className="h-4 w-px bg-gray-700" />

      {/* BTC Price */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-orange-400 text-xs font-bold">₿</span>
        </div>
        <span className="text-gray-300">${btcPrice.toLocaleString()}</span>
      </div>

      <div className="h-4 w-px bg-gray-700 hidden sm:block" />

      {/* Market Cap */}
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-gray-500">MCap:</span>
        <span className="text-gray-300">{formatLargeNumber(stxData.marketCap)}</span>
      </div>

      <div className="h-4 w-px bg-gray-700 hidden md:block" />

      {/* Volume */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-gray-500">24h Vol:</span>
        <span className="text-gray-300">{formatLargeNumber(stxData.volume24h)}</span>
      </div>
    </div>
  );
}
