'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';

export default function BridgeTransfer() {
  const [mode, setMode] = useState<'peg-in' | 'peg-out'>('peg-in');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { uintCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');
      
      const microAmount = Math.floor(parseFloat(amount) * 1_000_000);
      
      showContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'sbtc-vault',
        functionName: mode === 'peg-in' ? 'deposit' : 'withdraw',
        functionArgs: [uintCV(microAmount)],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.png',
        },
        onFinish: (data) => {
          console.log('TX:', data.txId);
          setAmount('');
          setLoading(false);
        },
        onCancel: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Bridge Operations</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('peg-in')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'peg-in'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Peg-In
        </button>
        <button
          onClick={() => setMode('peg-out')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'peg-out'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Peg-Out
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Amount (STX)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={loading || !amount}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'peg-in' ? 'Deposit' : 'Withdraw'}
        </button>
      </div>
    </div>
  );
}
