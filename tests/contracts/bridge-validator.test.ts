import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Bridge Validator Network", () => {
  describe("Validator Registration", () => {
    it("can register as validator", () => {
      const result = simnet.callPublicFn(
        "bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("cannot register with insufficient stake", () => {
      const result = simnet.callPublicFn(
        "bridge-validator", "register-validator",
        [Cl.uint(100), Cl.uint(1000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(14005));
    });

    it("cannot register twice", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const result = simnet.callPublicFn(
        "bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(14003));
    });

    it("cannot set commission above 30%", () => {
      const result = simnet.callPublicFn(
        "bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(5000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(14002));
    });

    it("can increase stake", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const result = simnet.callPublicFn(
        "bridge-validator", "increase-stake",
        [Cl.uint(5000000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Transaction Validation", () => {
    it("validator can submit transaction", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const txHash = new Uint8Array(32).fill(0xab);
      const senderAddr = new Uint8Array(32).fill(0xcd);
      const result = simnet.callPublicFn(
        "bridge-validator", "submit-transaction",
        [
          Cl.buffer(txHash),
          Cl.stringAscii("Bitcoin"),
          Cl.stringAscii("Stacks"),
          Cl.uint(1000000000),
          Cl.buffer(senderAddr),
          Cl.standardPrincipal(wallet2)
        ],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-validator cannot submit transaction", () => {
      const txHash = new Uint8Array(32).fill(0xab);
      const senderAddr = new Uint8Array(32).fill(0xcd);
      const result = simnet.callPublicFn(
        "bridge-validator", "submit-transaction",
        [
          Cl.buffer(txHash),
          Cl.stringAscii("Bitcoin"),
          Cl.stringAscii("Stacks"),
          Cl.uint(1000000000),
          Cl.buffer(senderAddr),
          Cl.standardPrincipal(wallet2)
        ],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(14004));
    });

    it("another validator can validate a transaction", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(500)], wallet2);

      const txHash = new Uint8Array(32).fill(0xab);
      const senderAddr = new Uint8Array(32).fill(0xcd);
      simnet.callPublicFn("bridge-validator", "submit-transaction",
        [Cl.buffer(txHash), Cl.stringAscii("Bitcoin"), Cl.stringAscii("Stacks"),
         Cl.uint(1000000000), Cl.buffer(senderAddr), Cl.standardPrincipal(wallet3)],
        wallet1);

      const result = simnet.callPublicFn(
        "bridge-validator", "validate-transaction",
        [Cl.uint(0), Cl.bool(true)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.bool(false)); // Not yet confirmed (need 3)
    });

    it("cannot validate same tx twice", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(500)], wallet2);

      const txHash = new Uint8Array(32).fill(0xab);
      const senderAddr = new Uint8Array(32).fill(0xcd);
      simnet.callPublicFn("bridge-validator", "submit-transaction",
        [Cl.buffer(txHash), Cl.stringAscii("Bitcoin"), Cl.stringAscii("Stacks"),
         Cl.uint(1000000000), Cl.buffer(senderAddr), Cl.standardPrincipal(wallet3)],
        wallet1);

      simnet.callPublicFn("bridge-validator", "validate-transaction",
        [Cl.uint(0), Cl.bool(true)], wallet2);
      const result = simnet.callPublicFn(
        "bridge-validator", "validate-transaction",
        [Cl.uint(0), Cl.bool(true)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(14008));
    });
  });

  describe("Slashing", () => {
    it("owner can slash a validator", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const evidence = new Uint8Array(32).fill(0xff);
      const result = simnet.callPublicFn(
        "bridge-validator", "slash-validator",
        [Cl.standardPrincipal(wallet1), Cl.buffer(evidence)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(1000000000)); // 10% of 10B
    });

    it("non-owner cannot slash", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const evidence = new Uint8Array(32).fill(0xff);
      const result = simnet.callPublicFn(
        "bridge-validator", "slash-validator",
        [Cl.standardPrincipal(wallet1), Cl.buffer(evidence)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(14001));
    });
  });

  describe("Delegation", () => {
    it("can delegate to a validator", () => {
      simnet.callPublicFn("bridge-validator", "register-validator",
        [Cl.uint(10000000000), Cl.uint(1000)], wallet1);
      const result = simnet.callPublicFn(
        "bridge-validator", "delegate-to-validator",
        [Cl.standardPrincipal(wallet1), Cl.uint(5000000000)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Read-Only Functions", () => {
    it("returns validator stats", () => {
      const result = simnet.callReadOnlyFn(
        "bridge-validator", "get-validator-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "total-validators": Cl.uint(0),
        "active-validators": Cl.uint(0),
        "total-stake": Cl.uint(0),
        "min-stake": Cl.uint(10000000000),
        "total-validations": Cl.uint(0),
        "required-confirmations": Cl.uint(3),
        "current-epoch": Cl.uint(0),
        "slash-rate": Cl.uint(1000),
        "reward-per-validation": Cl.uint(100000),
        "is-paused": Cl.bool(false)
      });
    });
  });
});
