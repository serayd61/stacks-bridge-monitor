'use client';

import { useState, useEffect } from 'react';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (userSession.isUserSignedIn()) {
      try {
        const userData = userSession.loadUserData();
        setAddress(userData.profile.stxAddress.mainnet);
      } catch (e) {
        console.error('Load user data error:', e);
      }
    }
  }, []);

  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: 'Stacks Bridge Monitor',
        icon: typeof window !== 'undefined' ? `${window.location.origin}/stacks-icon.svg` : '/stacks-icon.svg',
      },
      redirectTo: '/',
      onFinish: () => {
        if (userSession.isUserSignedIn()) {
          const userData = userSession.loadUserData();
          setAddress(userData.profile.stxAddress.mainnet);
        }
      },
      onCancel: () => {
        console.log('Connect cancelled');
      },
      userSession,
    });
  };

  const handleDisconnect = () => {
    userSession.signUserOut('/');
    setAddress(null);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) return null;

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={copyAddress}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">{address.slice(0, 6)}...{address.slice(-4)}</span>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
        <button
          onClick={handleDisconnect}
          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">Connect</span>
    </button>
  );
}
