'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, LogOut, Copy, Check, ExternalLink } from 'lucide-react';
import {
  isSignedIn,
  getUserAddress,
  connectWallet,
  disconnectWallet,
  userSession,
} from '@/lib/stacks-auth';

export default function WalletConnect() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const refreshState = useCallback(() => {
    const signed = isSignedIn();
    setConnected(signed);
    setAddress(signed ? getUserAddress() : null);
  }, []);

  useEffect(() => {
    // Check on mount whether the user was already signed in from a previous
    // session (the UserSession persists to localStorage).
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then(() => refreshState());
    } else {
      refreshState();
    }
  }, [refreshState]);

  const handleConnect = () => {
    connectWallet({
      onFinish: () => refreshState(),
      onCancel: () => {},
    });
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setConnected(false);
    setAddress(null);
    setShowMenu(false);
  };

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-purple-500 hover:to-orange-400 transition-all shadow-lg shadow-purple-500/20"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Connect Wallet</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        <div className="h-2 w-2 rounded-full bg-green-400" />
        <span className="font-mono text-gray-300">{truncatedAddress}</span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50 z-50">
            <div className="p-4 border-b border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Connected Address</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-white font-mono flex-1 truncate">
                  {address}
                </code>
                <button
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-2">
              <a
                href={`https://explorer.hiro.so/address/${address}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </a>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors w-full text-left"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
