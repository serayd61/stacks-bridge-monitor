import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchBridgeStats,
  fetchSTXData,
  fetchBTCPrice,
  fetchStacksStats,
  fetchNetworkHealth,
} from '../lib/api';

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchBridgeStats', () => {
    it('should return bridge stats on successful response', async () => {
      const mockTxData = {
        results: Array(50).fill({ tx_type: 'contract_call' }),
      };
      const mockMempoolData = { count: 1000, vsize: 500000 };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTxData),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMempoolData),
        } as Response);

      const stats = await fetchBridgeStats();

      expect(stats).toHaveProperty('totalVolume24h');
      expect(stats).toHaveProperty('totalTransactions');
      expect(stats).toHaveProperty('pegInCount');
      expect(stats).toHaveProperty('pegOutCount');
      expect(typeof stats.totalTransactions).toBe('number');
    });

    it('should return fallback data on API error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const stats = await fetchBridgeStats();

      expect(stats.totalVolume24h).toBe('127.45');
      expect(stats.totalTransactions).toBe(1847);
    });

    it('should return fallback data on 500 response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const stats = await fetchBridgeStats();

      expect(stats.totalVolume24h).toBe('127.45');
      expect(stats.activeUsers).toBe(423);
    });
  });

  describe('fetchSTXData', () => {
    it('should return STX data from CoinGecko', async () => {
      const mockData = {
        market_data: {
          current_price: { usd: 2.15 },
          price_change_percentage_24h: 5.5,
          market_cap: { usd: 3000000000 },
          total_volume: { usd: 50000000 },
          circulating_supply: 1500000000,
          total_supply: 1818000000,
        },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const data = await fetchSTXData();

      expect(data.price).toBe(2.15);
      expect(data.priceChange24h).toBe(5.5);
      expect(data.marketCap).toBe(3000000000);
    });

    it('should return fallback on error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('API Error'));

      const data = await fetchSTXData();

      expect(data.price).toBe(1.85);
      expect(data.priceChange24h).toBe(2.5);
    });
  });

  describe('fetchBTCPrice', () => {
    it('should return BTC price from CoinGecko', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 98000 } }),
      } as Response);

      const price = await fetchBTCPrice();

      expect(price).toBe(98000);
    });

    it('should return fallback price on error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const price = await fetchBTCPrice();

      expect(price).toBe(97500);
    });
  });

  describe('fetchStacksStats', () => {
    it('should return network stats from Hiro API', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stacks_tip_height: 180000 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tx_count: 50000000 }),
        } as Response);

      const stats = await fetchStacksStats();

      expect(stats.blockHeight).toBe(180000);
      expect(stats.totalTransactions).toBe(50000000);
    });
  });

  describe('fetchNetworkHealth', () => {
    it('should return healthy status on fast response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const health = await fetchNetworkHealth();

      expect(health.status).toBe('healthy');
      expect(health.uptime).toBe(99.98);
    });

    it('should return down status on error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Timeout'));

      const health = await fetchNetworkHealth();

      expect(health.status).toBe('down');
      expect(health.lastIncident).toBeDefined();
    });
  });
});
