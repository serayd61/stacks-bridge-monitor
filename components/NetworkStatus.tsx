'use client';

import { Activity, Blocks, Clock, Zap } from 'lucide-react';

interface NetworkStatusProps {
  stacksBlocks: any[];
  mempoolStats: any;
  btcMempool: any;
}

export default function NetworkStatus({
  stacksBlocks,
  mempoolStats,
  btcMempool,
}: NetworkStatusProps) {
  const latestBlock = stacksBlocks[0];
  
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Network Status</h3>
          <p className="text-sm text-gray-400">Stacks & Bitcoin networks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-green-400">Healthy</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stacks Network */}
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Blocks className="h-5 w-5 text-purple-400" />
            <span className="font-medium text-white">Stacks Network</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Block Height</p>
              <p className="font-mono text-white">
                {latestBlock?.height?.toLocaleString() || '---'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Mempool TXs</p>
              <p className="font-mono text-white">
                {mempoolStats?.tx_count?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Avg Block Time</p>
              <p className="font-mono text-white">~10 min</p>
            </div>
          </div>
        </div>

        {/* Bitcoin Network */}
        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-orange-400" />
            <span className="font-medium text-white">Bitcoin Network</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Mempool TXs</p>
              <p className="font-mono text-white">
                {btcMempool?.count?.toLocaleString() || '---'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Mempool Size</p>
              <p className="font-mono text-white">
                {btcMempool?.vsize 
                  ? `${(btcMempool.vsize / 1000000).toFixed(2)} MB`
                  : '---'
                }
              </p>
            </div>
            <div>
              <p className="text-gray-400">Avg Fee</p>
              <p className="font-mono text-white">~15 sat/vB</p>
            </div>
          </div>
        </div>

        {/* Recent Stacks Blocks */}
        <div className="mt-4">
          <p className="text-sm text-gray-400 mb-2">Recent Stacks Blocks</p>
          <div className="space-y-2">
            {stacksBlocks.slice(0, 3).map((block: any, index: number) => (
              <div
                key={block.hash || index}
                className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  <span className="font-mono text-white">#{block.height}</span>
                </div>
                <span className="text-gray-400">
                  {block.txs?.length || 0} txs
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
