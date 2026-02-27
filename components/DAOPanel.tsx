'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Vote,
  FileText,
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Clock,
} from 'lucide-react';
import { isSignedIn, getUserAddress, connectWallet, showContractCall, NETWORK } from '@/lib/stacks-auth';
import { uintCV, stringAsciiCV, principalCV, boolCV, PostConditionMode, AnchorMode } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';

type TabId = 'proposals' | 'voting' | 'members' | 'settings';

interface Proposal {
  id: number;
  title: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  endBlock: number;
}

export default function DAOPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('proposals');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [voteProposalId, setVoteProposalId] = useState('');
  const [voteSupport, setVoteSupport] = useState(true);
  const [memberAddress, setMemberAddress] = useState('');
  const [votingPeriod, setVotingPeriod] = useState('144');
  const [quorumThreshold, setQuorumThreshold] = useState('20');

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

  const createProposal = () => {
    if (!proposalTitle) return;
    setLoading(true);
    
    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'proposal-engine',
      functionName: 'create-proposal',
      functionArgs: [
        stringAsciiCV(proposalTitle.slice(0, 50)),
        stringAsciiCV(proposalDescription.slice(0, 500)),
        uintCV(144),
      ],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const castVote = () => {
    const id = parseInt(voteProposalId);
    if (isNaN(id)) return;
    setLoading(true);

    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'token-voting',
      functionName: 'cast-vote',
      functionArgs: [uintCV(id), boolCV(voteSupport)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const addMember = () => {
    if (!memberAddress) return;
    setLoading(true);

    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'membership-nft',
      functionName: 'mint-membership',
      functionArgs: [principalCV(memberAddress)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const updateSettings = () => {
    setLoading(true);

    showContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'proposal-engine',
      functionName: 'set-discussion-period',
      functionArgs: [uintCV(parseInt(votingPeriod) || 144)],
      postConditionMode: PostConditionMode.Allow,
      network: NETWORK,
      appDetails: { name: 'Stacks Bridge Monitor', icon: '/stacks-icon.png' },
      onFinish: handleTxFinish,
      onCancel: handleTxCancel,
    });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'proposals', label: 'Proposals', icon: <FileText className="h-4 w-4" /> },
    { id: 'voting', label: 'Vote', icon: <Vote className="h-4 w-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">DAO Governance</h3>
            <p className="text-sm text-gray-400">Manage proposals and voting</p>
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
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
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
            <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">
              Connect your wallet to participate in DAO governance
            </p>
            <button
              onClick={handleConnect}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-400 transition-all"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'proposals' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder="Enter proposal title..."
                    maxLength={50}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Description</label>
                  <textarea
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    placeholder="Describe your proposal..."
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={createProposal}
                  disabled={loading || !proposalTitle}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-500 py-3 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Proposal
                </button>
              </div>
            )}

            {activeTab === 'voting' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Proposal ID</label>
                  <input
                    type="number"
                    value={voteProposalId}
                    onChange={(e) => setVoteProposalId(e.target.value)}
                    placeholder="Enter proposal ID..."
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Vote</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setVoteSupport(true)}
                      className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all ${
                        voteSupport
                          ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      For
                    </button>
                    <button
                      onClick={() => setVoteSupport(false)}
                      className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all ${
                        !voteSupport
                          ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      Against
                    </button>
                  </div>
                </div>
                <button
                  onClick={castVote}
                  disabled={loading || !voteProposalId}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-500 py-3 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
                  Cast Vote
                </button>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Member Address</label>
                  <input
                    type="text"
                    value={memberAddress}
                    onChange={(e) => setMemberAddress(e.target.value)}
                    placeholder="SP..."
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={addMember}
                  disabled={loading || !memberAddress}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-500 py-3 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Mint Membership NFT
                </button>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Discussion Period (blocks)</label>
                  <input
                    type="number"
                    value={votingPeriod}
                    onChange={(e) => setVotingPeriod(e.target.value)}
                    placeholder="144"
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">~1 day = 144 blocks</p>
                </div>
                <button
                  onClick={updateSettings}
                  disabled={loading}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-500 py-3 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  Update Settings
                </button>
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
