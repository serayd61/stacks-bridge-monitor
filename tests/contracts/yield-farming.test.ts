import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Yield Farming", () => {
  describe("Farm Management", () => {
    it("deployer can add a farm", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "add-farm",
        [
          Cl.stringAscii("BRIDGE-STX LP"),
          Cl.uint(1000),
          Cl.uint(200), // 2% deposit fee
          Cl.uint(144), // ~1 day harvest lockup
          Cl.uint(288)  // ~2 day withdraw lockup
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-owner cannot add farm", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "add-farm",
        [Cl.stringAscii("Bad Farm"), Cl.uint(100), Cl.uint(0), Cl.uint(0), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(13001));
    });

    it("cannot set deposit fee above 10%", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "add-farm",
        [Cl.stringAscii("High Fee"), Cl.uint(100), Cl.uint(1500), Cl.uint(0), Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(13002));
    });

    it("can update farm allocation", () => {
      simnet.callPublicFn("yield-farming", "add-farm",
        [Cl.stringAscii("Farm 1"), Cl.uint(500), Cl.uint(0), Cl.uint(0), Cl.uint(0)], deployer);
      const result = simnet.callPublicFn(
        "yield-farming", "update-farm-alloc",
        [Cl.uint(0), Cl.uint(1000)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Deposits", () => {
    it("can deposit to farm", () => {
      simnet.callPublicFn("yield-farming", "add-farm",
        [Cl.stringAscii("Main Farm"), Cl.uint(1000), Cl.uint(100), Cl.uint(0), Cl.uint(0)], deployer);
      const result = simnet.callPublicFn(
        "yield-farming", "deposit",
        [Cl.uint(0), Cl.uint(1000000000)],
        wallet1
      );
      // With 1% deposit fee: 1000000000 - 10000000 = 990000000
      expect(result.result).toBeOk(Cl.uint(990000000));
    });

    it("cannot deposit 0", () => {
      simnet.callPublicFn("yield-farming", "add-farm",
        [Cl.stringAscii("Farm"), Cl.uint(100), Cl.uint(0), Cl.uint(0), Cl.uint(0)], deployer);
      const result = simnet.callPublicFn(
        "yield-farming", "deposit",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(13002));
    });

    it("cannot deposit to non-existent farm", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "deposit",
        [Cl.uint(99), Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(13003));
    });
  });

  describe("Read-Only Functions", () => {
    it("returns farming stats", () => {
      const result = simnet.callReadOnlyFn(
        "yield-farming", "get-farming-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "farm-count": Cl.uint(0),
        "total-alloc-points": Cl.uint(0),
        "reward-per-block": Cl.uint(5000000),
        "bonus-multiplier": Cl.uint(3),
        "bonus-end-block": Cl.uint(0),
        "total-rewards-distributed": Cl.uint(0),
        "is-paused": Cl.bool(false)
      });
    });

    it("returns boost tier info", () => {
      const result = simnet.callReadOnlyFn(
        "yield-farming", "get-boost-tier",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeSome(
        Cl.tuple({
          "min-deposit": Cl.uint(0),
          "multiplier-bps": Cl.uint(10000),
          name: Cl.stringAscii("Standard")
        })
      );
    });

    it("calculates user boost based on deposits", () => {
      const result = simnet.callReadOnlyFn(
        "yield-farming", "get-user-boost",
        [Cl.uint(50000000000)],
        deployer
      );
      expect(result.result).toBe(Cl.uint(15000)); // Silver Farmer 1.5x
    });
  });

  describe("Admin Controls", () => {
    it("can set reward per block", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "set-reward-per-block",
        [Cl.uint(10000000)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can toggle farming pause", () => {
      const result = simnet.callPublicFn(
        "yield-farming", "toggle-farming-pause", [], deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
