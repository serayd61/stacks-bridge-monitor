import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const fakeBtcTxid = Cl.buffer(new Uint8Array(32).fill(1));
const fakeBtcTxid2 = Cl.buffer(new Uint8Array(32).fill(2));

describe("Bridge Registry", () => {
  describe("Peg-In", () => {
    it("bridge operator can initiate peg-in", () => {
      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-operator cannot initiate peg-in", () => {
      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(2001));
    });

    it("prevents double processing of same BTC txid", () => {
      simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(2007));
    });

    it("rejects amount below minimum", () => {
      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(100), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(2006));
    });
  });

  describe("Peg-Out", () => {
    it("anyone can initiate peg-out", () => {
      const btcAddr = Cl.buffer(new Uint8Array(25).fill(3));
      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-out",
        [Cl.uint(1000000), btcAddr],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });
  });

  describe("Transaction Status", () => {
    it("can confirm and complete a transaction", () => {
      simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );

      const confirm = simnet.callPublicFn(
        "bridge-registry", "confirm-transaction",
        [Cl.uint(0)],
        deployer
      );
      expect(confirm.result).toBeOk(Cl.bool(true));

      const complete = simnet.callPublicFn(
        "bridge-registry", "complete-transaction",
        [Cl.uint(0)],
        deployer
      );
      expect(complete.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Bridge Stats", () => {
    it("returns correct stats after operations", () => {
      simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(2000000), fakeBtcTxid2, Cl.standardPrincipal(wallet2)],
        deployer
      );

      const stats = simnet.callReadOnlyFn("bridge-registry", "get-bridge-stats", [], deployer);
      const statsValue = stats.result as any;
      expect(statsValue.data["total-peg-ins"]).toBe(Cl.uint(2));
      expect(statsValue.data["total-volume"]).toBe(Cl.uint(3000000));
    });

    it("tracks fee calculation correctly", () => {
      const fee = simnet.callReadOnlyFn(
        "bridge-registry", "calculate-fee",
        [Cl.uint(10000000)],
        deployer
      );
      expect(fee.result).toBe(Cl.uint(25000)); // 0.25%
    });
  });

  describe("Admin Controls", () => {
    it("can add bridge operators", () => {
      simnet.callPublicFn(
        "bridge-registry", "set-bridge-operator",
        [Cl.standardPrincipal(wallet1), Cl.bool(true)],
        deployer
      );

      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("can pause bridge", () => {
      simnet.callPublicFn("bridge-registry", "toggle-bridge-pause", [], deployer);

      const result = simnet.callPublicFn(
        "bridge-registry", "initiate-peg-in",
        [Cl.uint(1000000), fakeBtcTxid, Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(2005));
    });
  });
});
