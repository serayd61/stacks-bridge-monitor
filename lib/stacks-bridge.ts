'use client';

// ---------------------------------------------------------------------------
// Stacks Bridge Integration
//
// Integrates @stacks/connect (wallet interaction) and @stacks/transactions
// (contract calls, post-conditions) with the Clarity contracts defined in
// /contracts.  Provides functions for:
//   - Reading on-chain bridge state (vault stats, LP positions, messages)
//   - Initiating write transactions through the Hiro wallet
//   - STX transfers for bridge operations
//   - Post-condition construction for safe transactions
// ---------------------------------------------------------------------------

import {
  showContractCall,
  showSTXTransfer,
} from '@stacks/connect';

import {
  fetchCallReadOnlyFunction,
  uintCV,
  principalCV,
  stringAsciiCV,
  bufferCV,
  tupleCV,
  listCV,
  noneCV,
  cvToJSON,
  cvToString,
  AnchorMode,
  PostConditionMode,
  Pc,
  FungibleConditionCode,
} from '@stacks/transactions';

import type { ClarityValue } from '@stacks/transactions';

import { userSession, BRIDGE_CONTRACTS, NETWORK } from './stacks-auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultStats {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  depositorCount: bigint;
  yieldPool: bigint;
  apyBps: bigint;
  vaultActive: boolean;
}

export interface VaultPosition {
  deposited: bigint;
  depositBlock: bigint;
  lastYieldClaim: bigint;
  totalYieldEarned: bigint;
  pendingWithdrawal: bigint;
  withdrawalRequestedAt: bigint | null;
}

export interface PoolStats {
  totalLiquidity: bigint;
  totalLpTokens: bigint;
  feePool: bigint;
  lpCount: bigint;
  paused: boolean;
}

export interface LpPosition {
  lpTokens: bigint;
  depositedAt: bigint;
  feesEarned: bigint;
  lastFeeClaim: bigint;
}

export interface CrosschainMessage {
  messageHash: string;
  sourceChain: string;
  targetChain: string;
  sender: string;
  recipient: string;
  payload: string;
  nonce: bigint;
  submittedAt: bigint;
  expiresAt: bigint;
  relayer: string;
  processed: boolean;
  status: number;
}

export interface VerifierStats {
  totalMessages: bigint;
  processed: bigint;
  relayers: bigint;
}

export interface BridgeTransferResult {
  txId: string;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBigInt(cv: any): bigint {
  const json = cvToJSON(cv);
  if (json?.value !== undefined) {
    return BigInt(json.value);
  }
  return BigInt(0);
}

/**
 * Helper to call a read-only function on a contract.
 * Uses fetchCallReadOnlyFunction from @stacks/transactions v7.
 */
async function readOnlyCall(
  contractAddress: string,
  contractName: string,
  functionName: string,
  functionArgs: ClarityValue[],
): Promise<any> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network: NETWORK,
    senderAddress: contractAddress,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Read-only functions -- sBTC Vault
// ---------------------------------------------------------------------------

/**
 * Fetch the global vault statistics from the sbtc-vault contract.
 */
export async function getVaultStats(): Promise<VaultStats> {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  const result = await readOnlyCall(address, name, 'get-vault-stats', []);
  const json = cvToJSON(result);
  const v = json.value;

  return {
    totalDeposits: BigInt(v['total-deposits'].value),
    totalWithdrawals: BigInt(v['total-withdrawals'].value),
    depositorCount: BigInt(v['depositor-count'].value),
    yieldPool: BigInt(v['yield-pool'].value),
    apyBps: BigInt(v['apy-bps'].value),
    vaultActive: v['vault-active'].value,
  };
}

/**
 * Fetch a specific depositor's vault position.
 */
export async function getVaultPosition(depositor: string): Promise<VaultPosition | null> {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  const result = await readOnlyCall(address, name, 'get-position', [
    principalCV(depositor),
  ]);

  const json = cvToJSON(result);
  if (!json.value) return null;

  const v = json.value;
  return {
    deposited: BigInt(v.deposited.value),
    depositBlock: BigInt(v['deposit-block'].value),
    lastYieldClaim: BigInt(v['last-yield-claim'].value),
    totalYieldEarned: BigInt(v['total-yield-earned'].value),
    pendingWithdrawal: BigInt(v['pending-withdrawal'].value),
    withdrawalRequestedAt: v['withdrawal-requested-at'].value
      ? BigInt(v['withdrawal-requested-at'].value.value)
      : null,
  };
}

/**
 * Calculate pending yield for a depositor.
 */
export async function calculateYield(depositor: string): Promise<bigint> {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  const result = await readOnlyCall(address, name, 'calculate-yield', [
    principalCV(depositor),
  ]);

  const json = cvToJSON(result);
  if (json.value?.value !== undefined) {
    return BigInt(json.value.value);
  }
  return BigInt(0);
}

// ---------------------------------------------------------------------------
// Read-only functions -- Liquidity Pool
// ---------------------------------------------------------------------------

/**
 * Fetch global liquidity pool statistics.
 */
export async function getPoolStats(): Promise<PoolStats> {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;

  const result = await readOnlyCall(address, name, 'get-pool-stats', []);
  const json = cvToJSON(result);
  const v = json.value;

  return {
    totalLiquidity: BigInt(v['total-liquidity'].value),
    totalLpTokens: BigInt(v['total-lp-tokens'].value),
    feePool: BigInt(v['fee-pool'].value),
    lpCount: BigInt(v['lp-count'].value),
    paused: v.paused.value,
  };
}

/**
 * Fetch an LP's position in the liquidity pool.
 */
export async function getLpPosition(lp: string): Promise<LpPosition | null> {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;

  const result = await readOnlyCall(address, name, 'get-lp-position', [
    principalCV(lp),
  ]);

  const json = cvToJSON(result);
  if (!json.value) return null;

  const v = json.value;
  return {
    lpTokens: BigInt(v['lp-tokens'].value),
    depositedAt: BigInt(v['deposited-at'].value),
    feesEarned: BigInt(v['fees-earned'].value),
    lastFeeClaim: BigInt(v['last-fee-claim'].value),
  };
}

/**
 * Calculate how many LP tokens a given deposit amount would receive.
 */
export async function calculateLpTokens(amount: bigint): Promise<bigint> {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;

  const result = await readOnlyCall(address, name, 'calculate-lp-tokens', [
    uintCV(amount),
  ]);

  return parseBigInt(result);
}

/**
 * Calculate the bridge fee for a given amount.
 */
export async function calculateBridgeFee(amount: bigint): Promise<bigint> {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;

  const result = await readOnlyCall(address, name, 'calculate-bridge-fee', [
    uintCV(amount),
  ]);

  return parseBigInt(result);
}

// ---------------------------------------------------------------------------
// Read-only functions -- Crosschain Verifier
// ---------------------------------------------------------------------------

/**
 * Fetch crosschain verifier stats.
 */
export async function getVerifierStats(): Promise<VerifierStats> {
  const { address, name } = BRIDGE_CONTRACTS.crosschainVerifier;

  const result = await readOnlyCall(address, name, 'get-stats', []);
  const json = cvToJSON(result);
  const v = json.value;

  return {
    totalMessages: BigInt(v['total-messages'].value),
    processed: BigInt(v.processed.value),
    relayers: BigInt(v.relayers.value),
  };
}

/**
 * Fetch a specific crosschain message by ID.
 */
export async function getCrosschainMessage(messageId: number): Promise<CrosschainMessage | null> {
  const { address, name } = BRIDGE_CONTRACTS.crosschainVerifier;

  const result = await readOnlyCall(address, name, 'get-message', [
    uintCV(messageId),
  ]);

  const json = cvToJSON(result);
  if (!json.value) return null;

  const v = json.value;
  return {
    messageHash: v['message-hash'].value,
    sourceChain: v['source-chain'].value,
    targetChain: v['target-chain'].value,
    sender: v.sender.value,
    recipient: v.recipient.value,
    payload: v.payload.value,
    nonce: BigInt(v.nonce.value),
    submittedAt: BigInt(v['submitted-at'].value),
    expiresAt: BigInt(v['expires-at'].value),
    relayer: v.relayer.value,
    processed: v.processed.value,
    status: Number(v.status.value),
  };
}

/**
 * Check if a nonce has already been used (replay protection).
 */
export async function isNonceUsed(nonceKey: string): Promise<boolean> {
  const { address, name } = BRIDGE_CONTRACTS.crosschainVerifier;

  const result = await readOnlyCall(address, name, 'is-nonce-used', [
    stringAsciiCV(nonceKey),
  ]);

  const json = cvToJSON(result);
  return json.value === true;
}

// ---------------------------------------------------------------------------
// Write transactions -- sBTC Vault (via Hiro wallet)
// ---------------------------------------------------------------------------

/**
 * Build STX post-conditions using the Pc builder (v7 API).
 */
function stxPostConditionLessEqual(senderAddress: string, amount: bigint) {
  return Pc.principal(senderAddress).willSendLte(amount).ustx();
}

function stxPostConditionEqual(senderAddress: string, amount: bigint) {
  return Pc.principal(senderAddress).willSendEq(amount).ustx();
}

/**
 * Deposit STX into the sBTC vault using the connected wallet.
 * Opens the Hiro wallet for the user to confirm.
 */
export function depositToVault(
  amountMicroStx: bigint,
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;
  const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;

  const postConditions = [
    stxPostConditionLessEqual(senderAddress, amountMicroStx),
  ];

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'deposit',
    functionArgs: [uintCV(amountMicroStx)],
    postConditionMode: PostConditionMode.Deny,
    postConditions,
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => {
      callbacks?.onFinish?.(data);
    },
    onCancel: () => {
      callbacks?.onCancel?.();
    },
  });
}

/**
 * Request a withdrawal from the vault.
 */
export function requestVaultWithdrawal(
  amount: bigint,
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'request-withdrawal',
    functionArgs: [uintCV(amount)],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

/**
 * Complete a pending withdrawal from the vault (after the delay period).
 */
export function completeVaultWithdrawal(
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'complete-withdrawal',
    functionArgs: [],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

/**
 * Claim accrued yield from the vault.
 */
export function claimVaultYield(
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.sbtcVault;

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'claim-yield',
    functionArgs: [],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

// ---------------------------------------------------------------------------
// Write transactions -- Liquidity Pool
// ---------------------------------------------------------------------------

/**
 * Add liquidity to the bridge liquidity pool.
 */
export function addLiquidity(
  amountMicroStx: bigint,
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;
  const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;

  const postConditions = [
    stxPostConditionLessEqual(senderAddress, amountMicroStx),
  ];

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'add-liquidity',
    functionArgs: [uintCV(amountMicroStx)],
    postConditionMode: PostConditionMode.Deny,
    postConditions,
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

/**
 * Remove liquidity by burning LP tokens.
 */
export function removeLiquidity(
  lpTokens: bigint,
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.bridgeLiquidityPool;

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'remove-liquidity',
    functionArgs: [uintCV(lpTokens)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

// ---------------------------------------------------------------------------
// Write transactions -- Crosschain Verifier
// ---------------------------------------------------------------------------

/**
 * Register as a relayer (requires staking 100 STX).
 */
export function registerAsRelayer(
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.crosschainVerifier;
  const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;

  const MIN_RELAYER_STAKE = BigInt(100_000_000); // 100 STX in microSTX

  const postConditions = [
    stxPostConditionEqual(senderAddress, MIN_RELAYER_STAKE),
  ];

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'register-relayer',
    functionArgs: [],
    postConditionMode: PostConditionMode.Deny,
    postConditions,
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

/**
 * Submit a crosschain message as an authorized relayer.
 */
export function submitCrosschainMessage(
  params: {
    messageHash: string;
    sourceChain: string;
    targetChain: string;
    sender: string;
    recipient: string;
    payload: string;
    nonce: number;
  },
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  const { address, name } = BRIDGE_CONTRACTS.crosschainVerifier;

  showContractCall({
    contractAddress: address,
    contractName: name,
    functionName: 'submit-message',
    functionArgs: [
      stringAsciiCV(params.messageHash),
      stringAsciiCV(params.sourceChain),
      stringAsciiCV(params.targetChain),
      stringAsciiCV(params.sender),
      principalCV(params.recipient),
      stringAsciiCV(params.payload),
      uintCV(params.nonce),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

// ---------------------------------------------------------------------------
// STX Transfer helper (e.g. for donations or direct bridge operations)
// ---------------------------------------------------------------------------

/**
 * Send STX to a recipient address via Hiro wallet.
 */
export function sendSTX(
  recipient: string,
  amountMicroStx: bigint,
  memo?: string,
  callbacks?: { onFinish?: (data: any) => void; onCancel?: () => void }
) {
  showSTXTransfer({
    recipient,
    amount: amountMicroStx,
    memo: memo || '',
    network: NETWORK,
    appDetails: {
      name: 'Stacks Bridge Monitor',
      icon: '/stacks-icon.png',
    },
    onFinish: (data) => callbacks?.onFinish?.(data),
    onCancel: () => callbacks?.onCancel?.(),
  });
}

// ---------------------------------------------------------------------------
// Aggregate bridge status -- combines data from multiple contracts
// ---------------------------------------------------------------------------

export interface BridgeOnChainStatus {
  vault: VaultStats;
  pool: PoolStats;
  verifier: VerifierStats;
}

/**
 * Fetch the combined on-chain status from all bridge contracts.
 * Falls back gracefully if any individual call fails.
 */
export async function getBridgeOnChainStatus(): Promise<BridgeOnChainStatus> {
  const [vault, pool, verifier] = await Promise.allSettled([
    getVaultStats(),
    getPoolStats(),
    getVerifierStats(),
  ]);

  const defaultVault: VaultStats = {
    totalDeposits: BigInt(0),
    totalWithdrawals: BigInt(0),
    depositorCount: BigInt(0),
    yieldPool: BigInt(0),
    apyBps: BigInt(500),
    vaultActive: true,
  };

  const defaultPool: PoolStats = {
    totalLiquidity: BigInt(0),
    totalLpTokens: BigInt(0),
    feePool: BigInt(0),
    lpCount: BigInt(0),
    paused: false,
  };

  const defaultVerifier: VerifierStats = {
    totalMessages: BigInt(0),
    processed: BigInt(0),
    relayers: BigInt(0),
  };

  return {
    vault: vault.status === 'fulfilled' ? vault.value : defaultVault,
    pool: pool.status === 'fulfilled' ? pool.value : defaultPool,
    verifier: verifier.status === 'fulfilled' ? verifier.value : defaultVerifier,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers for on-chain values
// ---------------------------------------------------------------------------

/**
 * Convert microSTX (u-integers) to human-readable STX string.
 */
export function microStxToStx(microStx: bigint): string {
  const stx = Number(microStx) / 1_000_000;
  return stx.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Convert a satoshi amount to BTC string.
 */
export function satsToBtc(sats: bigint): string {
  const btc = Number(sats) / 100_000_000;
  return btc.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

/**
 * Convert basis points to a percentage string.
 */
export function bpsToPercent(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + '%';
}
