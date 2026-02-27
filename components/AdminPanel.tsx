'use client';

import { useState } from 'react';
import { Settings, Percent, Shield, Loader2 } from 'lucide-react';

export default function AdminPanel() {
  const [feeBps, setFeeBps] = useState('50');
  const [loading, setLoading] = useState(false);

  const setFee = async () => {
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { uintCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');

      showContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'bridge-fee-calculator',
        functionName: 'set-fee-bps',
        functionArgs: [uintCV(parseInt(feeBps) || 50)],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.png',
        },
        onFinish: () => setLoading(false),
        onCancel: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const togglePause = async (pause: boolean) => {
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');

      showContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'bridge-pause-guardian',
        functionName: pause ? 'pause' : 'resume',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.png',
        },
        onFinish: () => setLoading(false),
        onCancel: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
          <Settings className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Admin Controls</h3>
          <p className="text-sm text-gray-400">Contract configuration</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            <Percent className="h-4 w-4 inline mr-1" />
            Bridge Fee (basis points)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={feeBps}
              onChange={(e) => setFeeBps(e.target.value)}
              placeholder="50"
              min="0"
              max="1000"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
            />
            <button
              onClick={setFee}
              disabled={loading}
              className="px-4 py-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
            >
              Set
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">100 bps = 1%</p>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <label className="block text-sm text-gray-400 mb-3">
            <Shield className="h-4 w-4 inline mr-1" />
            Emergency Controls
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => togglePause(true)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Pause Bridge
            </button>
            <button
              onClick={() => togglePause(false)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
            >
              Resume Bridge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
