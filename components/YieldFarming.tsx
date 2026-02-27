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
import { isSignedIn, getUserAddress, connectWallet, showContractCall, NETWORK } from '@/lib/stacks-auth';
import { 
  uintCV, 
  principalCV, 
  PostConditionMode,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from '@stacks/transactions';

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
  
  const [amount, setAmount] = useState('');
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | 'claim'>('deposit');
  
  const [poolStats, setPoolStats] = useState<PoolStats>({
    totalYieldPool: '0',
    totalDistributed: '0',
    totalDeposits: '0',
    currentApy: '0',
  });
  
  const [userPosition, setUserPosition] = useState<UserPosition>({
    deposited: '0',
    claimable: '0',
    totalEarned: '0',
    nextClaimBlock: 0,
  });

  const refreshState = useCallback(async () => {
    const signed = isSignedIn();
    setConnected(signed);
    
    if (signed) {
      const addr = getUserAddress();
      setAddress(addr);
      
      if (addr) {
        try {
          // Fetch user position
          const positionResult = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-depositor-info',
            functionArgs: [principalCV(addr)],
            network: NETWORK,
            senderAddress: addr,
          });
          
          const posJson = cvToJSON(positionResult);
          if (posJson.value) {
            setUserPosition({
              deposited: formatStx(posJson.value.amount?.value || '0'),
              claimable: '0', // Will fetch separately
              totalEarned: formatStx(posJson.value['total-earned']?.value || '0'),
              nextClaimBlock: parseInt(posJson.value['last-claim-block']?.value || '0') + 144,
            });
          }
          
          // Fetch claimable yield
          const claimableResult = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'calculate-claimable-yield',
            functionArgs: [principalCV(addr)],
            network: NETWORK,
            senderAddress: addr,
          });
          
          const claimJson = cvToJSON(claimableResult);
          if (claimJson.value !== undefined) {
            setUserPosition(prev => ({
              ...prev,
              claimable: formatStx(claimJson.value || '0'),
            }));
          }
        } catch (e) {
          console.log('Contract not deployed or error fetching data');
        }
      }
    }
    
    // Fetch pool stats
    try {
      const statsResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-pool-stats',
        functionArgs: [],
        network: NETWORK,
        senderAddress: CONTRACT_ADDRESS,
      });
      
      const statsJson = cvToJSON(statsResult);
      if (statsJson.value) {
        setPoolStats({
          totalYieldPool: formatStx(statsJson.value['total-yield-pool']?.value || '0'),
          totalDistributed: formatStx(statsJson.value['total-distributed']?.value || '0'),
          totalDeposits: formatStx(statsJson.value['total-deposits']?.value || '0'),
          currentApy: '0',
        });
      }
      
      // Fetch APY
      const apyResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'calculate-apy',
        functionArgs: [],
        network: NETWORK,
        senderAddress: CONTRACT_ADDRESS,
      });
      
      const apyJson = cvToJSON(apyResult);
      if (apyJson.value !== undefined) {
        setPoolStats(prev => ({
          ...prev,
          currentApy: (parseInt(apyJson.value || '0') / 100).toFixed(2),
        }));
      }
    } catch (e) {
      console.log('Error fetching pool stats');
    }
  }, []);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 30000);
    return () => clearInterval(interval);
  }, [refreshState]);

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
    setTimeout(refreshState, 2000);
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

  const handleDeposit = () => {
    const microStx = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(microStx) || microStx <= 0) return;
    
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'deposit',
      functionArgs: [uintCV(microStx)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const handleWithdraw = () => {
    const microStx = Math.floor(parseFloat(amount) * 1_000_000);
    if (isNaN(microStx) || microStx <= 0) return;
    
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'withdraw',
      functionArgs: [uintCV(microStx)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const handleClaim = () => {
    setLoading(true);
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'claim-yield',
      functionArgs: [],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Yield Farming</h3>
              <p className="text-sm text-gray-400">Earn rewards from bridge fees</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-400">{poolStats.currentApy}%</p>
            <p className="text-xs text-gray-400">Current APY</p>
          </div>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-800">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Total Deposits</p>
          <p className="text-sm font-mono text-white">{poolStats.totalDeposits} STX</p>
        </div>
        <div className="text-center border-x border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Yield Pool</p>
          <p className="text-sm font-mono text-green-400">{poolStats.totalYieldPool} STX</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Total Distributed</p>
          <p className="text-sm font-mono text-purple-400">{poolStats.totalDistributed} STX</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {!connected ? (
          <div className="text-center py-8">
            <PiggyBank className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm mb-4">
              Connect your wallet to start earning yield from bridge fees
            </p>
            <button
              onClick={handleConnect}
              className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-2.5 text-sm font-medium text-white hover:from-green-500 hover:to-emerald-400 transition-all shadow-lg shadow-green-500/20"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* User Position */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-gray-800/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Your Deposit</p>
                </div>
                <p className="text-xl font-mono font-bold text-white">{userPosition.deposited} STX</p>
              </div>
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-4 w-4 text-green-400" />
                  <p className="text-xs text-green-400">Claimable Yield</p>
                </div>
                <p className="text-xl font-mono font-bold text-green-400">{userPosition.claimable} STX</p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-800/30 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-400">Total Earned:</span>
              </div>
              <span className="text-sm font-mono text-purple-400">{userPosition.totalEarned} STX</span>
            </div>

            {/* Action Tabs */}
            <div className="flex gap-2">
              {[
                { id: 'deposit' as const, label: 'Deposit', icon: ArrowDownToLine },
                { id: 'withdraw' as const, label: 'Withdraw', icon: ArrowUpFromLine },
                { id: 'claim' as const, label: 'Claim', icon: Gift },
              ].map((action) => (
                <button
                  key={action.id}
                  onClick={() => setActiveAction(action.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeAction === action.id
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Action Form */}
            {activeAction !== 'claim' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {activeAction === 'deposit' ? 'Deposit Amount' : 'Withdraw Amount'} (STX)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 font-mono"
                    disabled={loading}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">STX</span>
                </div>
              </div>
            )}

            {activeAction === 'claim' && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                <Gift className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-mono font-bold text-green-400 mb-1">{userPosition.claimable} STX</p>
                <p className="text-xs text-gray-400">Available to claim</p>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={() => {
                if (activeAction === 'deposit') handleDeposit();
                else if (activeAction === 'withdraw') handleWithdraw();
                else handleClaim();
              }}
              disabled={loading || (activeAction !== 'claim' && (!amount || parseFloat(amount) <= 0))}
              className={`w-full rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-400 shadow-lg shadow-green-500/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : activeAction === 'deposit' ? (
                <>
                  <ArrowDownToLine className="h-4 w-4" />
                  Deposit & Start Earning
                </>
              ) : activeAction === 'withdraw' ? (
                <>
                  <ArrowUpFromLine className="h-4 w-4" />
                  Withdraw Funds
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4" />
                  Claim Yield
                </>
              )}
            </button>

            {/* Info Box */}
            <div className="rounded-lg bg-gray-800/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-gray-400">70% of bridge fees go to depositors</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-yellow-400" />
                <span className="text-gray-400">Claim cooldown: ~24 hours (144 blocks)</span>
              </div>
            </div>
          </>
        )}

        {/* Transaction Status */}
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
