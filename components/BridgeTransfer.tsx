'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';
import { isSignedIn, getUserAddress, connectWallet } from '@/lib/stacks-auth';
import {
  depositToVault,
  requestVaultWithdrawal,
  claimVaultYield,
  addLiquidity,
  getVaultPosition,
  calculateYield,
  microStxToStx,
  bpsToPercent,
  type VaultPosition,
} from '@/lib/stacks-bridge';

type TabId = 'deposit' | 'withdraw' | 'yield' | 'liquidity';

export default function BridgeTransfer() {
  const [activeTab, setActiveTab] = useState<TabId>('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [position, setPosition] = useState<VaultPosition | null>(null);
  const [pendingYield, setPendingYield] = useState<bigint>(BigInt(0));
  const [connected, setConnected] = useState(false);

  const refreshState = useCallback(async () => {
    const signed = isSignedIn();
    setConnected(signed);
    if (!signed) return;

    const addr = getUserAddress();
    if (!addr) return;

    try {
      const [pos, yld] = await Promise.allSettled([
        getVaultPosition(addr),
        calculateYield(addr),
      ]);
      if (pos.status === 'fulfilled') setPosition(pos.value);
      if (yld.status === 'fulfilled') setPendingYield(yld.value);
    } catch {
      // Silently ignore -- contracts may not be deployed yet
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const resetStatus = () => {
    setTimeout(() => {
      setTxStatus('idle');
      setTxId(null);
    }, 5000);
  };

  const handleTxFinish = (data: any) => {
    setLoading(false);
    setTxStatus('success');
    setTxId(data.txId);
    setAmount('');
    resetStatus();
    refreshState();
  };

  const handleTxCancel = () => {
    setLoading(false);
    setTxStatus('error');
    resetStatus();
  };

  const handleConnect = () => {
    connectWallet({
      onFinish: () => {
        setConnected(true);
        refreshState();
      },
    });
  };

  const amountMicroStx = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return BigInt(0);
    return BigInt(Math.floor(parsed * 1_000_000));
  };

  const handleDeposit = () => {
    const micro = amountMicroStx();
    if (micro <= BigInt(0)) return;
    setLoading(true);
    depositToVault(micro, { onFinish: handleTxFinish, onCancel: handleTxCancel });
  };

  const handleWithdraw = () => {
    const micro = amountMicroStx();
    if (micro <= BigInt(0)) return;
    setLoading(true);
    requestVaultWithdrawal(micro, { onFinish: handleTxFinish, onCancel: handleTxCancel });
  };

  const handleClaimYield = () => {
    setLoading(true);
    claimVaultYield({ onFinish: handleTxFinish, onCancel: handleTxCancel });
  };

  const handleAddLiquidity = () => {
    const micro = amountMicroStx();
    if (micro <= BigInt(0)) return;
    setLoading(true);
    addLiquidity(micro, { onFinish: handleTxFinish, onCancel: handleTxCancel });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'deposit', label: 'Deposit', icon: <ArrowDownUp className="h-4 w-4" /> },
    { id: 'withdraw', label: 'Withdraw', icon: <Shield className="h-4 w-4" /> },
    { id: 'yield', label: 'Yield', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'liquidity', label: 'LP', icon: <Zap className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Bridge Operations</h3>
        <p className="text-sm text-gray-400">Interact with sBTC bridge contracts</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setTxStatus('idle');
            }}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors flex-1 justify-center
              ${
                activeTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }
            `}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {/* Wallet position summary */}
        {connected && position && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-800/50 p-3">
              <p className="text-xs text-gray-400">Deposited</p>
              <p className="text-sm font-mono text-white">
                {microStxToStx(position.deposited)} STX
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-3">
              <p className="text-xs text-gray-400">Yield Earned</p>
              <p className="text-sm font-mono text-green-400">
                {microStxToStx(position.totalYieldEarned)} STX
              </p>
            </div>
            {position.pendingWithdrawal > BigInt(0) && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 col-span-2">
                <p className="text-xs text-yellow-400">Pending Withdrawal</p>
                <p className="text-sm font-mono text-yellow-300">
                  {microStxToStx(position.pendingWithdrawal)} STX
                </p>
              </div>
            )}
          </div>
        )}

        {/* Not connected prompt */}
        {!connected && (
          <div className="text-center py-6">
            <Wallet className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">
              Connect your wallet to interact with bridge contracts
            </p>
            <button
              onClick={handleConnect}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:from-purple-500 hover:to-orange-400 transition-all"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Action forms */}
        {connected && (
          <>
            {(activeTab === 'deposit' ||
              activeTab === 'withdraw' ||
              activeTab === 'liquidity') && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {activeTab === 'deposit'
                    ? 'Deposit Amount (STX)'
                    : activeTab === 'withdraw'
                    ? 'Withdrawal Amount (STX)'
                    : 'Liquidity Amount (STX)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
                    disabled={loading}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    STX
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'yield' && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Claimable Yield</p>
                <p className="text-2xl font-mono font-bold text-green-400">
                  {microStxToStx(pendingYield)} STX
                </p>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={() => {
                switch (activeTab) {
                  case 'deposit':
                    handleDeposit();
                    break;
                  case 'withdraw':
                    handleWithdraw();
                    break;
                  case 'yield':
                    handleClaimYield();
                    break;
                  case 'liquidity':
                    handleAddLiquidity();
                    break;
                }
              }}
              disabled={
                loading ||
                (activeTab !== 'yield' &&
                  (amount === '' || parseFloat(amount) <= 0))
              }
              className={`
                w-full rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2
                ${
                  loading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-orange-500 text-white hover:from-purple-500 hover:to-orange-400 shadow-lg shadow-purple-500/20'
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for wallet...
                </>
              ) : activeTab === 'deposit' ? (
                'Deposit to Vault'
              ) : activeTab === 'withdraw' ? (
                'Request Withdrawal'
              ) : activeTab === 'yield' ? (
                'Claim Yield'
              ) : (
                'Add Liquidity'
              )}
            </button>
          </>
        )}

        {/* Transaction status */}
        {txStatus === 'success' && (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-green-400">Transaction submitted</p>
              {txId && (
                <a
                  href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-500 hover:underline font-mono truncate block"
                >
                  {txId}
                </a>
              )}
            </div>
          </div>
        )}

        {txStatus === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">Transaction cancelled or failed</p>
          </div>
        )}
      </div>
    </div>
  );
}
