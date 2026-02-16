'use client';

import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { RecentTransaction, timeAgo } from '@/lib/api';

interface TransactionTableProps {
  transactions: RecentTransaction[];
}

export default function TransactionTable({ transactions }: TransactionTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return classes[status as keyof typeof classes] || '';
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="border-b border-gray-800 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
        <p className="text-sm text-gray-400">Latest sBTC bridge activity</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">TX ID</th>
              <th className="px-6 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr
                key={tx.txId}
                className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        rounded-lg p-2
                        ${tx.type === 'peg-in' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-orange-500/20 text-orange-400'
                        }
                      `}
                    >
                      {tx.type === 'peg-in' 
                        ? <ArrowDownLeft className="h-4 w-4" />
                        : <ArrowUpRight className="h-4 w-4" />
                      }
                    </div>
                    <span className="font-medium text-white capitalize">
                      {tx.type.replace('-', ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-white">{tx.amount} BTC</span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`
                      inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium
                      ${getStatusBadge(tx.status)}
                    `}
                  >
                    {getStatusIcon(tx.status)}
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <code className="rounded bg-gray-800 px-2 py-1 text-sm text-gray-300">
                    {tx.txId}
                  </code>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {timeAgo(tx.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-gray-800 px-6 py-3">
        <button className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors">
          View all transactions →
        </button>
      </div>
    </div>
  );
}
