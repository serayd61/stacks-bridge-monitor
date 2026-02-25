import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Flash Loan Protocol", () => {
  describe("Pool Management", () => {
    it("deployer can create a flash loan pool", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "create-pool",
        [Cl.stringAscii("Main Pool"), Cl.uint(9), Cl.uint(8000)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-owner cannot create pool", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "create-pool",
        [Cl.stringAscii("Bad Pool"), Cl.uint(9), Cl.uint(8000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(11001));
    });

    it("cannot set fee above max", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "create-pool",
        [Cl.stringAscii("High Fee Pool"), Cl.uint(200), Cl.uint(8000)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(11012));
    });
  });

  describe("Liquidity Provision", () => {
    it("can deposit liquidity to pool", () => {
      simnet.callPublicFn("flash-loan", "create-pool",
        [Cl.stringAscii("Test Pool"), Cl.uint(9), Cl.uint(8000)], deployer);
      const result = simnet.callPublicFn(
        "flash-loan", "deposit-liquidity",
        [Cl.uint(0), Cl.uint(1000000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(1000000000));
    });

    it("cannot deposit 0 amount", () => {
      simnet.callPublicFn("flash-loan", "create-pool",
        [Cl.stringAscii("Test Pool"), Cl.uint(9), Cl.uint(8000)], deployer);
      const result = simnet.callPublicFn(
        "flash-loan", "deposit-liquidity",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(11004));
    });

    it("cannot deposit to non-existent pool", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "deposit-liquidity",
        [Cl.uint(99), Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(11005));
    });
  });

  describe("Flash Loan Operations", () => {
    it("can initiate flash loan", () => {
      simnet.callPublicFn("flash-loan", "create-pool",
        [Cl.stringAscii("Flash Pool"), Cl.uint(9), Cl.uint(8000)], deployer);
      simnet.callPublicFn("flash-loan", "deposit-liquidity",
        [Cl.uint(0), Cl.uint(10000000000)], wallet1);

      const result = simnet.callPublicFn(
        "flash-loan", "initiate-flash-loan",
        [Cl.uint(0), Cl.uint(1000000000)],
        wallet2
      );
      expect(result.result).toBeOk(
        Cl.tuple({
          "loan-id": Cl.uint(0),
          amount: Cl.uint(1000000000),
          fee: Cl.uint(900000)
        })
      );
    });

    it("cannot borrow more than available", () => {
      simnet.callPublicFn("flash-loan", "create-pool",
        [Cl.stringAscii("Small Pool"), Cl.uint(9), Cl.uint(8000)], deployer);
      simnet.callPublicFn("flash-loan", "deposit-liquidity",
        [Cl.uint(0), Cl.uint(1000)], wallet1);

      const result = simnet.callPublicFn(
        "flash-loan", "initiate-flash-loan",
        [Cl.uint(0), Cl.uint(10000000)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(11002));
    });
  });

  describe("Read-Only Functions", () => {
    it("calculates flash loan fee correctly", () => {
      simnet.callPublicFn("flash-loan", "create-pool",
        [Cl.stringAscii("Fee Pool"), Cl.uint(9), Cl.uint(8000)], deployer);
      const result = simnet.callReadOnlyFn(
        "flash-loan", "calculate-flash-fee",
        [Cl.uint(0), Cl.uint(10000000)],
        deployer
      );
      expect(result.result).toBe(Cl.uint(9000)); // 0.09%
    });

    it("returns protocol stats", () => {
      const result = simnet.callReadOnlyFn(
        "flash-loan", "get-flash-loan-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "total-loans": Cl.uint(0),
        "total-volume": Cl.uint(0),
        "total-fees-earned": Cl.uint(0),
        "default-fee-bps": Cl.uint(9),
        "pool-count": Cl.uint(0),
        "is-paused": Cl.bool(false)
      });
    });
  });

  describe("Admin Controls", () => {
    it("can update flash fee", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "set-flash-fee",
        [Cl.uint(15)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can toggle protocol pause", () => {
      const result = simnet.callPublicFn(
        "flash-loan", "toggle-protocol-pause", [], deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
