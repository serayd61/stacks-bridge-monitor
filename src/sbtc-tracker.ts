/**
 * sBTC Tracker
 * Monitors sBTC peg-in and peg-out operations
 */

import { config } from './index';

export interface SBTCOperation {
  type: 'peg-in' | 'peg-out';
  btcTxId: string;
  stacksTxId: string | null;
  amount: bigint;
  fee: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  btcAddress: string;
  stacksAddress: string;
  timestamp: Date;
  confirmations: number;
}

export interface SBTCMetrics {
  totalPeggedIn: bigint;
  totalPeggedOut: bigint;
  netFlow: bigint;
  avgPegInTime: number; // in blocks
  avgPegOutTime: number;
  successRate: number;
}

// Track pending operations
const pendingOperations: Map<string, SBTCOperation> = new Map();

/**
 * Fetch sBTC contract events from Stacks API
 */
export async function fetchSBTCEvents(
  fromBlock?: number,
  toBlock?: number
): Promise<any[]> {
  const params = new URLSearchParams();
  if (fromBlock) params.set('start_block', fromBlock.toString());
  if (toBlock) params.set('end_block', toBlock.toString());
  
  try {
    const response = await fetch(
      `${config.stacksApiUrl}/extended/v1/contract/events?${params}`
    );
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Failed to fetch sBTC events:', error);
    return [];
  }
}

/**
 * Process peg-in operation
 */
export function processPegIn(
  btcTxId: string,
  amount: bigint,
  btcAddress: string,
  stacksAddress: string
): SBTCOperation {
  const operation: SBTCOperation = {
    type: 'peg-in',
    btcTxId,
    stacksTxId: null,
    amount,
    fee: BigInt(0),
    status: 'pending',
    btcAddress,
    stacksAddress,
    timestamp: new Date(),
    confirmations: 0,
  };
  
  pendingOperations.set(btcTxId, operation);
  console.log(`New peg-in: ${amount} sats from ${btcAddress}`);
  
  return operation;
}

/**
 * Process peg-out operation
 */
export function processPegOut(
  stacksTxId: string,
  amount: bigint,
  stacksAddress: string,
  btcAddress: string
): SBTCOperation {
  const operation: SBTCOperation = {
    type: 'peg-out',
    btcTxId: '',
    stacksTxId,
    amount,
    fee: BigInt(0),
    status: 'pending',
    btcAddress,
    stacksAddress,
    timestamp: new Date(),
    confirmations: 0,
  };
  
  pendingOperations.set(stacksTxId, operation);
  console.log(`New peg-out: ${amount} sats to ${btcAddress}`);
  
  return operation;
}

/**
 * Update operation status
 */
export function updateOperationStatus(
  txId: string,
  status: 'pending' | 'confirmed' | 'failed',
  confirmations?: number
): void {
  const operation = pendingOperations.get(txId);
  if (operation) {
    operation.status = status;
    if (confirmations !== undefined) {
      operation.confirmations = confirmations;
    }
    
    if (status === 'confirmed' || status === 'failed') {
      // Move to completed
      pendingOperations.delete(txId);
    }
  }
}

/**
 * Get pending operations
 */
export function getPendingOperations(): SBTCOperation[] {
  return Array.from(pendingOperations.values());
}

/**
 * Calculate sBTC metrics
 */
export function calculateMetrics(operations: SBTCOperation[]): SBTCMetrics {
  const pegIns = operations.filter(op => op.type === 'peg-in');
  const pegOuts = operations.filter(op => op.type === 'peg-out');
  const confirmed = operations.filter(op => op.status === 'confirmed');
  
  const totalPeggedIn = pegIns.reduce((sum, op) => sum + op.amount, BigInt(0));
  const totalPeggedOut = pegOuts.reduce((sum, op) => sum + op.amount, BigInt(0));
  
  return {
    totalPeggedIn,
    totalPeggedOut,
    netFlow: totalPeggedIn - totalPeggedOut,
    avgPegInTime: 0, // Would calculate from actual data
    avgPegOutTime: 0,
    successRate: operations.length > 0 
      ? confirmed.length / operations.length 
      : 0,
  };
}

/**
 * Monitor Bitcoin mempool for sBTC deposits
 */
export async function monitorBitcoinMempool(): Promise<void> {
  try {
    const response = await fetch(`${config.bitcoinApiUrl}/mempool/recent`);
    const txs = await response.json();
    
    // Would filter for sBTC deposit addresses
    console.log(`Monitoring ${txs.length} mempool transactions`);
  } catch (error) {
    console.error('Failed to monitor Bitcoin mempool:', error);
  }
}

export default {
  fetchSBTCEvents,
  processPegIn,
  processPegOut,
  updateOperationStatus,
  getPendingOperations,
  calculateMetrics,
  monitorBitcoinMempool,
};
