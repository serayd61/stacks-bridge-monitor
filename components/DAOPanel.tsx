'use client';

import { useState } from 'react';
import { Vote, Users, FileText, Loader2 } from 'lucide-react';

export default function DAOPanel() {
  const [proposalTitle, setProposalTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const createProposal = async () => {
    if (!proposalTitle) return;
    setLoading(true);

    try {
      const { showContractCall } = await import('@stacks/connect');
      const { stringAsciiCV, uintCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');

      showContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'proposal-engine',
        functionName: 'create-proposal',
        functionArgs: [
          stringAsciiCV(proposalTitle.slice(0, 50)),
          stringAsciiCV('Created via dashboard'),
          uintCV(144),
        ],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.svg',
        },
        onFinish: () => {
          setProposalTitle('');
          setLoading(false);
        },
        onCancel: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const castVote = async (proposalId: number, support: boolean) => {
    setLoading(true);
    try {
      const { showContractCall } = await import('@stacks/connect');
      const { uintCV, boolCV, PostConditionMode } = await import('@stacks/transactions');
      const { STACKS_MAINNET } = await import('@stacks/network');

      showContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'token-voting',
        functionName: 'cast-vote',
        functionArgs: [uintCV(proposalId), boolCV(support)],
        postConditionMode: PostConditionMode.Allow,
        network: STACKS_MAINNET,
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: '/stacks-icon.svg',
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
        <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Vote className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">DAO Governance</h3>
          <p className="text-sm text-gray-400">Create & vote on proposals</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">New Proposal</label>
          <input
            type="text"
            value={proposalTitle}
            onChange={(e) => setProposalTitle(e.target.value)}
            placeholder="Proposal title..."
            maxLength={50}
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={createProposal}
          disabled={loading || !proposalTitle}
          className="w-full py-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <FileText className="h-4 w-4" />
          Create Proposal
        </button>

        <div className="border-t border-gray-800 pt-4">
          <p className="text-sm text-gray-400 mb-3">Quick Vote (Proposal #1)</p>
          <div className="flex gap-2">
            <button
              onClick={() => castVote(1, true)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
            >
              Vote For
            </button>
            <button
              onClick={() => castVote(1, false)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Vote Against
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
