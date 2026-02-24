import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Governance DAO", () => {
  describe("Proposal Creation", () => {
    it("can create a proposal", () => {
      const result = simnet.callPublicFn(
        "governance", "create-proposal",
        [
          Cl.stringAscii("Increase bridge fee to 0.5%"),
          Cl.stringUtf8("Proposal to increase the bridge fee from 0.25% to 0.5% for sustainability"),
          Cl.stringAscii("fee-change"),
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("increments proposal count", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test 1"), Cl.stringUtf8("Desc 1"), Cl.stringAscii("test")], deployer);
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test 2"), Cl.stringUtf8("Desc 2"), Cl.stringAscii("test")], wallet1);

      const count = simnet.callReadOnlyFn("governance", "get-proposal-count", [], deployer);
      expect(count.result).toBe(Cl.uint(2));
    });
  });

  describe("Voting", () => {
    it("can vote on a proposal", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test"), Cl.stringUtf8("Desc"), Cl.stringAscii("test")], deployer);

      const result = simnet.callPublicFn(
        "governance", "vote",
        [Cl.uint(0), Cl.bool(true), Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot vote twice", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test"), Cl.stringUtf8("Desc"), Cl.stringAscii("test")], deployer);

      simnet.callPublicFn("governance", "vote",
        [Cl.uint(0), Cl.bool(true), Cl.uint(1000000)], wallet1);

      const result = simnet.callPublicFn(
        "governance", "vote",
        [Cl.uint(0), Cl.bool(true), Cl.uint(500000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(4003));
    });

    it("records vote correctly", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test"), Cl.stringUtf8("Desc"), Cl.stringAscii("test")], deployer);

      simnet.callPublicFn("governance", "vote",
        [Cl.uint(0), Cl.bool(true), Cl.uint(1000000)], wallet1);

      const vote = simnet.callReadOnlyFn(
        "governance", "get-vote",
        [Cl.uint(0), Cl.standardPrincipal(wallet1)],
        deployer
      );
      const voteData = vote.result as any;
      expect(voteData.data.amount).toBe(Cl.uint(1000000));
      expect(voteData.data.support).toBe(Cl.bool(true));
    });
  });

  describe("Proposal Cancellation", () => {
    it("proposer can cancel their proposal", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test"), Cl.stringUtf8("Desc"), Cl.stringAscii("test")], wallet1);

      const result = simnet.callPublicFn(
        "governance", "cancel-proposal",
        [Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("non-proposer cannot cancel", () => {
      simnet.callPublicFn("governance", "create-proposal",
        [Cl.stringAscii("Test"), Cl.stringUtf8("Desc"), Cl.stringAscii("test")], wallet1);

      const result = simnet.callPublicFn(
        "governance", "cancel-proposal",
        [Cl.uint(0)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(4001));
    });
  });

  describe("Delegation", () => {
    it("can delegate voting power", () => {
      const result = simnet.callPublicFn(
        "governance", "delegate-to",
        [Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));

      const delegate = simnet.callReadOnlyFn(
        "governance", "get-delegate",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(delegate.result).toBeSome(Cl.standardPrincipal(wallet2));
    });

    it("cannot delegate to self", () => {
      const result = simnet.callPublicFn(
        "governance", "delegate-to",
        [Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(4012));
    });
  });

  describe("Governance Stats", () => {
    it("returns correct governance parameters", () => {
      const stats = simnet.callReadOnlyFn("governance", "get-governance-stats", [], deployer);
      const data = (stats.result as any).data;
      expect(data["voting-period"]).toBe(Cl.uint(1008));
      expect(data["quorum-percentage"]).toBe(Cl.uint(10));
    });
  });
});
