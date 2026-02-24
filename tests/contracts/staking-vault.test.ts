import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Staking Vault", () => {
  describe("Staking", () => {
    it("can stake tokens with flexible lock", () => {
      const result = simnet.callPublicFn(
        "staking-vault", "stake",
        [Cl.uint(1000000), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can stake with 30-day lock", () => {
      const result = simnet.callPublicFn(
        "staking-vault", "stake",
        [Cl.uint(1000000), Cl.uint(1)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot stake 0 tokens", () => {
      const result = simnet.callPublicFn(
        "staking-vault", "stake",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(5005));
    });

    it("cannot double stake", () => {
      simnet.callPublicFn("staking-vault", "stake", [Cl.uint(1000000), Cl.uint(0)], wallet1);
      const result = simnet.callPublicFn(
        "staking-vault", "stake",
        [Cl.uint(500000), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(5008));
    });
  });

  describe("Unstaking", () => {
    it("can unstake flexible position immediately", () => {
      simnet.callPublicFn("staking-vault", "stake", [Cl.uint(1000000), Cl.uint(0)], wallet1);
      const result = simnet.callPublicFn("staking-vault", "unstake", [], wallet1);
      expect(result.result).toBeOk(Cl.tuple({
        amount: Cl.uint(1000000),
        rewards: Cl.uint(0)
      }));
    });

    it("cannot unstake without staking", () => {
      const result = simnet.callPublicFn("staking-vault", "unstake", [], wallet2);
      expect(result.result).toBeErr(Cl.uint(5003));
    });
  });

  describe("Staker Info", () => {
    it("returns correct staker info", () => {
      simnet.callPublicFn("staking-vault", "stake", [Cl.uint(1000000), Cl.uint(0)], wallet1);
      const info = simnet.callReadOnlyFn(
        "staking-vault", "get-staker-info",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      const data = (info.result as any).data;
      expect(data.amount).toBe(Cl.uint(1000000));
      expect(data.multiplier).toBe(Cl.uint(100));
    });
  });

  describe("Multipliers", () => {
    it("returns correct multiplier for each lock type", () => {
      expect(simnet.callReadOnlyFn("staking-vault", "get-multiplier", [Cl.uint(0)], deployer).result)
        .toBe(Cl.uint(100));
      expect(simnet.callReadOnlyFn("staking-vault", "get-multiplier", [Cl.uint(1)], deployer).result)
        .toBe(Cl.uint(150));
      expect(simnet.callReadOnlyFn("staking-vault", "get-multiplier", [Cl.uint(2)], deployer).result)
        .toBe(Cl.uint(200));
      expect(simnet.callReadOnlyFn("staking-vault", "get-multiplier", [Cl.uint(3)], deployer).result)
        .toBe(Cl.uint(300));
    });
  });

  describe("Staking Stats", () => {
    it("tracks total staked", () => {
      simnet.callPublicFn("staking-vault", "stake", [Cl.uint(1000000), Cl.uint(0)], wallet1);
      simnet.callPublicFn("staking-vault", "stake", [Cl.uint(2000000), Cl.uint(1)], wallet2);

      const stats = simnet.callReadOnlyFn("staking-vault", "get-staking-stats", [], deployer);
      const data = (stats.result as any).data;
      expect(data["total-staked"]).toBe(Cl.uint(3000000));
      expect(data["total-stakers"]).toBe(Cl.uint(2));
    });
  });
});
