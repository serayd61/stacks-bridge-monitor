'use client';

import {
  AppConfig,
  UserSession,
  authenticate,
  disconnect as stacksDisconnect,
  isConnected as stacksIsConnected,
  showContractCall,
  showSTXTransfer,
} from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { StacksNetwork } from '@stacks/network';

// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

export type NetworkMode = 'mainnet' | 'testnet';

export function getNetwork(mode: NetworkMode = 'mainnet'): StacksNetwork {
  return mode === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

export const NETWORK = getNetwork('mainnet');

// ---------------------------------------------------------------------------
// Contract addresses -- matches the Clarity contracts in /contracts
// ---------------------------------------------------------------------------

export const BRIDGE_CONTRACTS = {
  sbtcVault: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'sbtc-vault',
  },
  crosschainVerifier: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'crosschain-verifier',
  },
  bridgeLiquidityPool: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'bridge-liquidity-pool',
  },
  bridgeFeeCalculator: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'bridge-fee-calculator',
  },
  bridgePauseGuardian: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'bridge-pause-guardian',
  },
  bridgeRateLimiter: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'bridge-rate-limiter',
  },
  bridgeAnalytics: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'bridge-analytics',
  },
  btcTxVerifier: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'btc-tx-verifier',
  },
  pegRatioTracker: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'peg-ratio-tracker',
  },
  sbtcReserveAuditor: {
    address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
    name: 'sbtc-reserve-auditor',
  },
} as const;

export type ContractKey = keyof typeof BRIDGE_CONTRACTS;

// ---------------------------------------------------------------------------
// Authentication helpers
// ---------------------------------------------------------------------------

export function isSignedIn(): boolean {
  return userSession.isUserSignedIn();
}

export function getUserData() {
  if (!isSignedIn()) return null;
  return userSession.loadUserData();
}

export function getUserAddress(): string | null {
  const data = getUserData();
  if (!data) return null;
  // mainnet address
  return data.profile?.stxAddress?.mainnet ?? null;
}

export function getUserTestnetAddress(): string | null {
  const data = getUserData();
  if (!data) return null;
  return data.profile?.stxAddress?.testnet ?? null;
}

export interface ConnectWalletOptions {
  onFinish?: () => void;
  onCancel?: () => void;
}

/**
 * Connect wallet using the @stacks/connect v8 `authenticate` function.
 * This triggers the Hiro wallet popup and populates UserSession on success.
 */
export function connectWallet(options: ConnectWalletOptions = {}) {
  authenticate(
    {
      appDetails: {
        name: 'Stacks Bridge Monitor',
        icon: '/stacks-icon.png',
      },
      onFinish: () => {
        options.onFinish?.();
      },
      onCancel: () => {
        options.onCancel?.();
      },
      userSession,
    },
  );
}

export function disconnectWallet() {
  userSession.signUserOut();
}

// Re-export commonly used connect functions for convenience
export { showContractCall, showSTXTransfer };
