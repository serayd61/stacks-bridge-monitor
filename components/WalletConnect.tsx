'use client';

import { useState, useEffect, useRef } from 'react';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const userSessionRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    
    const initSession = async () => {
      try {
        const { AppConfig, UserSession } = await import('@stacks/connect');
        const appConfig = new AppConfig(['store_write', 'publish_data']);
        const userSession = new UserSession({ appConfig });
        userSessionRef.current = userSession;
        
        if (userSession.isUserSignedIn()) {
          const userData = userSession.loadUserData();
          const addr = userData.profile.stxAddress.mainnet;
          setAddress(addr);
        }
      } catch (e) {
        console.error('Init session error:', e);
      }
    };
    
    initSession();
  }, []);

  const connect = async () => {
    try {
      const { showConnect, AppConfig, UserSession } = await import('@stacks/connect');
      
      if (!userSessionRef.current) {
        const appConfig = new AppConfig(['store_write', 'publish_data']);
        userSessionRef.current = new UserSession({ appConfig });
      }
      
      showConnect({
        appDetails: {
          name: 'Stacks Bridge Monitor',
          icon: window.location.origin + '/stacks-icon.svg',
        },
        onFinish: () => {
          window.location.reload();
        },
        onCancel: () => {
          console.log('User cancelled');
        },
        userSession: userSessionRef.current,
      });
    } catch (e) {
      console.error('Connect error:', e);
    }
  };

  const disconnect = async () => {
    try {
      if (userSessionRef.current) {
        userSessionRef.current.signUserOut();
      }
      setAddress(null);
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isClient) return null;

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
          onClick={disconnect}
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
      onClick={connect}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">Connect</span>
    </button>
  );
}
