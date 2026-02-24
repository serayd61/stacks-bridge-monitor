import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Multi-Sig Treasury", () => {
  describe("Deposits", () => {
    it("anyone can deposit", () => {
      const result = simnet.callPublicFn(
        "multisig-treasury", "deposit",
        [Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot deposit 0", () => {
      const result = simnet.callPublicFn(
        "multisig-treasury", "deposit",
        [Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(8012));
    });
  });

  describe("Propose Transaction", () => {
    it("signer can propose transaction", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(10000000)], deployer);

      const result = simnet.callPublicFn(
        "multisig-treasury", "propose-transaction",
        [Cl.standardPrincipal(wallet1), Cl.uint(1000000), Cl.stringAscii("Development fund")],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-signer cannot propose", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(10000000)], deployer);

      const result = simnet.callPublicFn(
        "multisig-treasury", "propose-transaction",
        [Cl.standardPrincipal(wallet2), Cl.uint(1000000), Cl.stringAscii("Test")],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(8002));
    });
  });

  describe("Signing", () => {
    it("second signer can sign", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(10000000)], deployer);
      simnet.callPublicFn("multisig-treasury", "add-signer", [Cl.standardPrincipal(wallet1)], deployer);
      simnet.callPublicFn("multisig-treasury", "propose-transaction",
        [Cl.standardPrincipal(wallet2), Cl.uint(1000000), Cl.stringAscii("Test")], deployer);

      const result = simnet.callPublicFn(
        "multisig-treasury", "sign-transaction",
        [Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(2));
    });

    it("cannot sign twice", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(10000000)], deployer);
      simnet.callPublicFn("multisig-treasury", "propose-transaction",
        [Cl.standardPrincipal(wallet1), Cl.uint(1000000), Cl.stringAscii("Test")], deployer);

      const result = simnet.callPublicFn(
        "multisig-treasury", "sign-transaction",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(8003));
    });
  });

  describe("Execution", () => {
    it("executes when threshold met", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(10000000)], deployer);
      simnet.callPublicFn("multisig-treasury", "add-signer", [Cl.standardPrincipal(wallet1)], deployer);
      simnet.callPublicFn("multisig-treasury", "propose-transaction",
        [Cl.standardPrincipal(wallet2), Cl.uint(1000000), Cl.stringAscii("Test")], deployer);
      simnet.callPublicFn("multisig-treasury", "sign-transaction", [Cl.uint(0)], wallet1);

      const result = simnet.callPublicFn(
        "multisig-treasury", "execute-transaction",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Signer Management", () => {
    it("owner can add signers", () => {
      const result = simnet.callPublicFn(
        "multisig-treasury", "add-signer",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("non-owner cannot add signers", () => {
      const result = simnet.callPublicFn(
        "multisig-treasury", "add-signer",
        [Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(8001));
    });
  });

  describe("Treasury Stats", () => {
    it("returns correct stats", () => {
      simnet.callPublicFn("multisig-treasury", "deposit", [Cl.uint(5000000)], deployer);
      const stats = simnet.callReadOnlyFn("multisig-treasury", "get-treasury-stats", [], deployer);
      const data = (stats.result as any).data;
      expect(data.balance).toBe(Cl.uint(5000000));
      expect(data["signer-count"]).toBe(Cl.uint(1));
      expect(data["required-signatures"]).toBe(Cl.uint(2));
    });
  });
});
