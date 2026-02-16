import { describe, it, expect } from 'vitest';
import {
  processPegIn,
  processPegOut,
  getPendingOperations,
  calculateMetrics,
  updateOperationStatus,
} from '../src/sbtc-tracker';

describe('sBTC Tracker', () => {
  describe('Peg-in Operations', () => {
    it('should create pending peg-in operation', () => {
      const op = processPegIn(
        'btc-tx-123',
        BigInt(100000000),
        'bc1qtest...',
        'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB'
      );
      
      expect(op.type).toBe('peg-in');
      expect(op.status).toBe('pending');
      expect(op.amount).toBe(BigInt(100000000));
    });

    it('should track pending operations', () => {
      const pending = getPendingOperations();
      expect(pending.length).toBeGreaterThan(0);
    });
  });

  describe('Peg-out Operations', () => {
    it('should create pending peg-out operation', () => {
      const op = processPegOut(
        'stx-tx-456',
        BigInt(50000000),
        'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        'bc1qtest...'
      );
      
      expect(op.type).toBe('peg-out');
      expect(op.status).toBe('pending');
    });
  });

  describe('Status Updates', () => {
    it('should update operation status', () => {
      updateOperationStatus('btc-tx-123', 'confirmed', 6);
      // Operation should be removed from pending
    });
  });

  describe('Metrics', () => {
    it('should calculate correct metrics', () => {
      const operations = [
        {
          type: 'peg-in' as const,
          btcTxId: '1',
          stacksTxId: '1',
          amount: BigInt(100000000),
          fee: BigInt(1000),
          status: 'confirmed' as const,
          btcAddress: 'bc1q...',
          stacksAddress: 'SP...',
          timestamp: new Date(),
          confirmations: 6,
        },
        {
          type: 'peg-out' as const,
          btcTxId: '2',
          stacksTxId: '2',
          amount: BigInt(50000000),
          fee: BigInt(1000),
          status: 'confirmed' as const,
          btcAddress: 'bc1q...',
          stacksAddress: 'SP...',
          timestamp: new Date(),
          confirmations: 6,
        },
      ];
      
      const metrics = calculateMetrics(operations);
      
      expect(metrics.totalPeggedIn).toBe(BigInt(100000000));
      expect(metrics.totalPeggedOut).toBe(BigInt(50000000));
      expect(metrics.netFlow).toBe(BigInt(50000000));
      expect(metrics.successRate).toBe(1);
    });
  });
});
