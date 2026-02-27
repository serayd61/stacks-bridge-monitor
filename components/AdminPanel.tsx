'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Gauge,
  DollarSign,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Lock,
} from 'lucide-react';
import { isSignedIn, getUserAddress, connectWallet, showContractCall, NETWORK } from '@/lib/stacks-auth';
import { uintCV, principalCV, boolCV, PostConditionMode } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';

type TabId = 'fees' | 'limits' | 'pause' | 'analytics';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('fees');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txId, setTxId] = useState<string | null>(null);

  const [feeBps, setFeeBps] = useState('50');
  const [feeCollector, setFeeCollector] = useState('');
  const [globalLimit, setGlobalLimit] = useState('100000000000');
  const [userLimit, setUserLimit] = useState('1000000000');
  const [limitUser, setLimitUser] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [apyBps, setApyBps] = useState('500');

  const refreshState = useCallback(() => {
    setConnected(isSignedIn());
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
    resetStatus();
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

  const setFee = () => {
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'bridge-fee-calculator',
      functionName: 'set-fee-bps',
      functionArgs: [uintCV(parseInt(feeBps) || 50)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const setCollector = () => {
    if (!feeCollector) return;
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'bridge-fee-calculator',
      functionName: 'set-fee-collector',
      functionArgs: [principalCV(feeCollector)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const setGlobalLimitTx = () => {
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'bridge-rate-limiter',
      functionName: 'set-global-limit',
      functionArgs: [uintCV(BigInt(globalLimit))],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const setUserLimitTx = () => {
    if (!limitUser) return;
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'bridge-rate-limiter',
      functionName: 'set-user-limit',
      functionArgs: [principalCV(limitUser), uintCV(BigInt(userLimit))],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const togglePause = () => {
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'bridge-rate-limiter',
      functionName: 'toggle-limiter',
      functionArgs: [boolCV(!isPaused)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: (data) => {
        handleTxFinish(data);
        setIsPaused(!isPaused);
      },
      onCancel: handleTxCancel,
    });
  };

  const setVaultApy = () => {
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'sbtc-vault',
      functionName: 'set-apy-bps',
      functionArgs: [uintCV(parseInt(apyBps) || 500)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'fees', label: 'Fees', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'limits', label: 'Limits', icon: <Gauge className="h-4 w-4" /> },
    { id: 'pause', label: 'Controls', icon: <Shield className="h-4 w-4" /> },
    { id: 'analytics', label: 'Vault', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Lock className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Admin Controls</h3>
            <p className="text-sm text-gray-400">Contract administration</p>
          </div>
        </div>
      </div>

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
              ${activeTab === tab.id
                ? 'text-red-400 border-b-2 border-red-400 bg-red-500/5'
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
        {!connected ? (
          <div className="text-center py-6">
            <Lock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">
              Connect admin wallet to access controls
            </p>
            <button
              onClick={handleConnect}
              className="rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:from-red-500 hover:to-orange-400 transition-all"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'fees' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fee (basis points)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={feeBps}
                      onChange={(e) => setFeeBps(e.target.value)}
                      placeholder="50"
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                      disabled={loading}
                    />
                    <button
                      onClick={setFee}
                      disabled={loading}
                      className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">100 bps = 1%</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fee Collector Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feeCollector}
                      onChange={(e) => setFeeCollector(e.target.value)}
                      placeholder="SP..."
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono text-sm"
                      disabled={loading}
                    />
                    <button
                      onClick={setCollector}
                      disabled={loading || !feeCollector}
                      className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'limits' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Global Daily Limit (sats)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={globalLimit}
                      onChange={(e) => setGlobalLimit(e.target.value)}
                      placeholder="100000000000"
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono"
                      disabled={loading}
                    />
                    <button
                      onClick={setGlobalLimitTx}
                      disabled={loading}
                      className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Current: {(parseInt(globalLimit) / 100000000).toLocaleString()} BTC</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">User Address</label>
                  <input
                    type="text"
                    value={limitUser}
                    onChange={(e) => setLimitUser(e.target.value)}
                    placeholder="SP..."
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono text-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">User Limit (sats)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userLimit}
                      onChange={(e) => setUserLimit(e.target.value)}
                      placeholder="1000000000"
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono"
                      disabled={loading}
                    />
                    <button
                      onClick={setUserLimitTx}
                      disabled={loading || !limitUser}
                      className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pause' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-800/50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-medium">Rate Limiter Status</p>
                      <p className="text-sm text-gray-400">Control bridge rate limiting</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isPaused 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {isPaused ? 'Disabled' : 'Active'}
                    </div>
                  </div>
                  <button
                    onClick={togglePause}
                    disabled={loading}
                    className={`w-full rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isPaused
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                        : 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    {isPaused ? 'Enable Rate Limiter' : 'Disable Rate Limiter'}
                  </button>
                </div>

                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium text-sm">Admin Only</p>
                      <p className="text-yellow-400/70 text-xs mt-1">
                        These controls are restricted to contract administrators. 
                        Unauthorized access will be rejected by the contract.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Vault APY (basis points)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={apyBps}
                      onChange={(e) => setApyBps(e.target.value)}
                      placeholder="500"
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                      disabled={loading}
                    />
                    <button
                      onClick={setVaultApy}
                      disabled={loading}
                      className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">500 bps = 5% APY</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-800/50 p-4">
                    <p className="text-xs text-gray-400">Current APY</p>
                    <p className="text-xl font-bold text-green-400">{(parseInt(apyBps) / 100).toFixed(2)}%</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/50 p-4">
                    <p className="text-xs text-gray-400">Fee Rate</p>
                    <p className="text-xl font-bold text-purple-400">{(parseInt(feeBps) / 100).toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

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
