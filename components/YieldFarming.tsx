'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PiggyBank,
  BarChart3,
} from 'lucide-react';

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'yield-distributor';

interface PoolStats {
  totalYieldPool: string;
  totalDistributed: string;
  totalDeposits: string;
  currentApy: string;
}

interface UserPosition {
  deposited: string;
  claimable: string;
  totalEarned: string;
  nextClaimBlock: number;
}

export default function YieldFarming() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | 'claim'>('deposit');
  
  const [poolStats, setPoolStats] = useState<PoolStats>({
    totalYieldPool: '0',
    totalDistributed: '0',
    totalDeposits: '0',
    currentApy: '5.00',
  });
  
  const [userPosition, setUserPosition] = useState<UserPosition>({
    deposited: '0',
    claimable: '0',
    totalEarned: '0',
    nextClaimBlock: 0,
  });

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem('stacks-address');
    if (stored) {
      setAddress(stored);
      setConnected(true);
    }
  }, []);

  const formatStx = (microStx: string): string => {
    const stx = parseInt(microStx) / 1_000_000;
    return stx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

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
  };

  const handleTxCancel = () => {
    setLoading(false);
    setTxStatus('error');
    resetStatus();
  };

  const handleConnect = async () => {
    try {
      const { showConnect, AppConfig, UserSession } = await import('@stacks/connect');
      const appConfig = new AppConfig(['store_write']);
      const userSession = new UserSession({ appConfig });
      
      showConnect({
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.png',
        },
        onFinish: () => {
          const userData = userSession.loadUserData();
          const addr = userData.profile.stxAddress.mainnet;
          setAddress(addr);
          setConnected(true);
          localStorage.setItem('stacks-address', addr);
        },
        userSession,
      });
    } catch (e) {
      console.error('Connect error:', e);
    }
  };

  const handleDeposit = async () => {
    const microStx = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(microStx) || microStx <= 0) return;
    
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { uintCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');
      
      showContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'deposit',
        functionArgs: [uintCV(microStx)],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
        onFinish: handleTxFinish,
        onCancel: handleTxCancel,
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const microStx = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(microStx) || microStx <= 0) return;
    
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { uintCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');
      
      showContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'withdraw',
        functionArgs: [uintCV(microStx)],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
        onFinish: handleTxFinish,
        onCancel: handleTxCancel,
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');
      
      showContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'claim-yield',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
        onFinish: handleTxFinish,
        onCancel: handleTxCancel,
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleAction = () => {
    if (activeAction === 'deposit') handleDeposit();
    else if (activeAction === 'withdraw') handleWithdraw();
    else handleClaim();
  };

  if (!isClient) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Yield Farming</h3>
          <p className="text-sm text-gray-400">Earn from bridge fees</p>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <PiggyBank className="h-3 w-3" />
            Total Deposits
          </div>
          <p className="text-white font-semibold">{poolStats.totalDeposits} STX</p>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <TrendingUp className="h-3 w-3" />
            APY
          </div>
          <p className="text-green-400 font-semibold">{poolStats.currentApy}%</p>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <BarChart3 className="h-3 w-3" />
            Yield Pool
          </div>
          <p className="text-white font-semibold">{poolStats.totalYieldPool} STX</p>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Gift className="h-3 w-3" />
            Distributed
          </div>
          <p className="text-white font-semibold">{poolStats.totalDistributed} STX</p>
        </div>
      </div>

      {!connected ? (
        <button
          onClick={handleConnect}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </button>
      ) : (
        <>
          {/* User Position */}
          <div className="rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4 mb-4">
            <p className="text-xs text-gray-400 mb-2">Your Position</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-white font-semibold">{userPosition.deposited}</p>
                <p className="text-xs text-gray-400">Deposited</p>
              </div>
              <div>
                <p className="text-green-400 font-semibold">{userPosition.claimable}</p>
                <p className="text-xs text-gray-400">Claimable</p>
              </div>
              <div>
                <p className="text-white font-semibold">{userPosition.totalEarned}</p>
                <p className="text-xs text-gray-400">Earned</p>
              </div>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveAction('deposit')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeAction === 'deposit'
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowDownToLine className="h-3 w-3" />
              Deposit
            </button>
            <button
              onClick={() => setActiveAction('withdraw')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeAction === 'withdraw'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowUpFromLine className="h-3 w-3" />
              Withdraw
            </button>
            <button
              onClick={() => setActiveAction('claim')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeAction === 'claim'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Gift className="h-3 w-3" />
              Claim
            </button>
          </div>

          {/* Amount Input */}
          {activeAction !== 'claim' && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount (STX)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
              />
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleAction}
            disabled={loading || (activeAction !== 'claim' && !amount)}
            className={`w-full py-3 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              activeAction === 'deposit'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                : activeAction === 'withdraw'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {activeAction === 'deposit' && 'Deposit STX'}
            {activeAction === 'withdraw' && 'Withdraw STX'}
            {activeAction === 'claim' && 'Claim Yield'}
          </button>

          {/* TX Status */}
          {txStatus === 'success' && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-400">Transaction submitted!</span>
            </div>
          )}
          {txStatus === 'error' && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">Transaction cancelled</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
