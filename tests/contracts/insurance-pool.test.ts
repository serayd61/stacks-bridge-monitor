import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Insurance Pool", () => {
  describe("Staking (Underwriting)", () => {
    it("can stake to insurance pool", () => {
      const result = simnet.callPublicFn(
        "insurance-pool", "stake-insurance",
        [Cl.uint(100000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot stake below minimum", () => {
      const result = simnet.callPublicFn(
        "insurance-pool", "stake-insurance",
        [Cl.uint(100)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(12002));
    });

    it("cannot double stake", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(100000000)], wallet1);
      const result = simnet.callPublicFn(
        "insurance-pool", "stake-insurance",
        [Cl.uint(100000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(12011));
    });

    it("can request unstake", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(100000000)], wallet1);
      const result = simnet.callPublicFn(
        "insurance-pool", "request-unstake", [], wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Coverage Purchase", () => {
    it("can purchase bridge failure coverage", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(1000000000)], wallet1);
      const result = simnet.callPublicFn(
        "insurance-pool", "purchase-coverage",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(4320)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("cannot purchase with invalid coverage type duration", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(1000000000)], wallet1);
      const result = simnet.callPublicFn(
        "insurance-pool", "purchase-coverage",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(10)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(12002));
    });
  });

  describe("Claims", () => {
    it("policy holder can file a claim", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(1000000000)], wallet1);
      simnet.callPublicFn("insurance-pool", "purchase-coverage",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(4320)], wallet2);

      const evidence = new Uint8Array(32).fill(1);
      const result = simnet.callPublicFn(
        "insurance-pool", "file-claim",
        [Cl.uint(0), Cl.uint(50000000), Cl.buffer(evidence)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-holder cannot file claim", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(1000000000)], wallet1);
      simnet.callPublicFn("insurance-pool", "purchase-coverage",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(4320)], wallet2);

      const evidence = new Uint8Array(32).fill(1);
      const result = simnet.callPublicFn(
        "insurance-pool", "file-claim",
        [Cl.uint(0), Cl.uint(50000000), Cl.buffer(evidence)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(12001));
    });

    it("deployer can assess and approve claim", () => {
      simnet.callPublicFn("insurance-pool", "stake-insurance",
        [Cl.uint(1000000000)], wallet1);
      simnet.callPublicFn("insurance-pool", "purchase-coverage",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(4320)], wallet2);
      const evidence = new Uint8Array(32).fill(1);
      simnet.callPublicFn("insurance-pool", "file-claim",
        [Cl.uint(0), Cl.uint(50000000), Cl.buffer(evidence)], wallet2);

      const result = simnet.callPublicFn(
        "insurance-pool", "assess-claim",
        [Cl.uint(0), Cl.bool(true), Cl.uint(50000000)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(1)); // CLAIM-APPROVED
    });
  });

  describe("Read-Only Functions", () => {
    it("returns insurance stats", () => {
      const result = simnet.callReadOnlyFn(
        "insurance-pool", "get-insurance-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "total-pool-balance": Cl.uint(0),
        "total-coverage-active": Cl.uint(0),
        "total-premiums-collected": Cl.uint(0),
        "total-claims-paid": Cl.uint(0),
        "total-policies": Cl.uint(0),
        "total-claims": Cl.uint(0),
        "total-stakers": Cl.uint(0),
        "total-staked": Cl.uint(0),
        "utilization-ratio": Cl.uint(0),
        "is-paused": Cl.bool(false)
      });
    });

    it("calculates premium correctly", () => {
      const result = simnet.callReadOnlyFn(
        "insurance-pool", "calculate-premium",
        [Cl.uint(0), Cl.uint(100000000), Cl.uint(52560)],
        deployer
      );
      // base: 100000000 * 200 / 10000 = 2000000 (2%)
      // duration adj: 2000000 * 52560 / 52560 = 2000000
      // type adj (1x for bridge failure): 2000000 * 10000 / 10000 = 2000000
      expect(result.result).toBe(Cl.uint(2000000));
    });

    it("returns coverage type info", () => {
      const result = simnet.callReadOnlyFn(
        "insurance-pool", "get-coverage-type-info",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Bridge Failure"),
          "premium-multiplier": Cl.uint(10000),
          "max-payout-bps": Cl.uint(10000),
          "is-active": Cl.bool(true)
        })
      );
    });
  });

  describe("Admin Controls", () => {
    it("can set assessor", () => {
      const result = simnet.callPublicFn(
        "insurance-pool", "set-assessor",
        [Cl.standardPrincipal(wallet1), Cl.bool(true)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can toggle pool pause", () => {
      const result = simnet.callPublicFn(
        "insurance-pool", "toggle-pool-pause", [], deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
