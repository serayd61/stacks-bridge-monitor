import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Token Vesting", () => {
  describe("Schedule Creation", () => {
    it("deployer can create vesting schedule", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "create-vesting-schedule",
        [
          Cl.standardPrincipal(wallet1),
          Cl.uint(100000000000), // 100k tokens
          Cl.uint(4320),        // 30-day cliff
          Cl.uint(52560),       // 1 year duration
          Cl.uint(1),           // cliff-linear
          Cl.uint(0),           // team
          Cl.bool(true)         // revocable
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-admin cannot create schedule", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "create-vesting-schedule",
        [
          Cl.standardPrincipal(wallet2),
          Cl.uint(1000000),
          Cl.uint(100),
          Cl.uint(1000),
          Cl.uint(0),
          Cl.uint(0),
          Cl.bool(false)
        ],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(15001));
    });

    it("cannot create with 0 amount", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "create-vesting-schedule",
        [
          Cl.standardPrincipal(wallet1),
          Cl.uint(0),
          Cl.uint(100),
          Cl.uint(1000),
          Cl.uint(0),
          Cl.uint(0),
          Cl.bool(false)
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(15002));
    });

    it("cliff cannot exceed duration", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "create-vesting-schedule",
        [
          Cl.standardPrincipal(wallet1),
          Cl.uint(1000000),
          Cl.uint(10000), // cliff > duration
          Cl.uint(1000),
          Cl.uint(0),
          Cl.uint(0),
          Cl.bool(false)
        ],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(15008));
    });
  });

  describe("Milestones", () => {
    it("can add milestone to milestone-type schedule", () => {
      simnet.callPublicFn("token-vesting", "create-vesting-schedule",
        [Cl.standardPrincipal(wallet1), Cl.uint(100000000), Cl.uint(0),
         Cl.uint(52560), Cl.uint(2), Cl.uint(3), Cl.bool(false)], deployer);

      const result = simnet.callPublicFn(
        "token-vesting", "add-milestone",
        [Cl.uint(0), Cl.stringAscii("MVP Launch"), Cl.uint(25000000)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("can approve milestone", () => {
      simnet.callPublicFn("token-vesting", "create-vesting-schedule",
        [Cl.standardPrincipal(wallet1), Cl.uint(100000000), Cl.uint(0),
         Cl.uint(52560), Cl.uint(2), Cl.uint(3), Cl.bool(false)], deployer);
      simnet.callPublicFn("token-vesting", "add-milestone",
        [Cl.uint(0), Cl.stringAscii("MVP Launch"), Cl.uint(25000000)], deployer);

      const result = simnet.callPublicFn(
        "token-vesting", "approve-milestone",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Revocation", () => {
    it("can revoke revocable schedule", () => {
      simnet.callPublicFn("token-vesting", "create-vesting-schedule",
        [Cl.standardPrincipal(wallet1), Cl.uint(100000000), Cl.uint(0),
         Cl.uint(52560), Cl.uint(0), Cl.uint(0), Cl.bool(true)], deployer);

      const result = simnet.callPublicFn(
        "token-vesting", "revoke-schedule",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(100000000)); // all unvested returned
    });

    it("cannot revoke non-revocable schedule", () => {
      simnet.callPublicFn("token-vesting", "create-vesting-schedule",
        [Cl.standardPrincipal(wallet1), Cl.uint(100000000), Cl.uint(0),
         Cl.uint(52560), Cl.uint(0), Cl.uint(0), Cl.bool(false)], deployer);

      const result = simnet.callPublicFn(
        "token-vesting", "revoke-schedule",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(15006));
    });
  });

  describe("Read-Only Functions", () => {
    it("returns vesting stats", () => {
      const result = simnet.callReadOnlyFn(
        "token-vesting", "get-vesting-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "total-schedules": Cl.uint(0),
        "total-allocated": Cl.uint(0),
        "total-claimed": Cl.uint(0),
        "total-revoked": Cl.uint(0),
        outstanding: Cl.uint(0),
        "total-milestones": Cl.uint(0),
        "is-paused": Cl.bool(false)
      });
    });

    it("returns category info", () => {
      const result = simnet.callReadOnlyFn(
        "token-vesting", "get-category-info",
        [Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Team"),
          "total-allocated": Cl.uint(0),
          "total-claimed": Cl.uint(0),
          "max-allocation": Cl.uint(200000000000000),
          "beneficiary-count": Cl.uint(0)
        })
      );
    });

    it("returns vesting progress", () => {
      const result = simnet.callReadOnlyFn(
        "token-vesting", "get-vesting-progress",
        [Cl.uint(99)], // non-existent schedule
        deployer
      );
      expect(result.result).toBeTuple({
        "schedule-id": Cl.uint(99),
        "progress-bps": Cl.uint(0),
        vested: Cl.uint(0),
        claimed: Cl.uint(0),
        remaining: Cl.uint(0),
        "blocks-remaining": Cl.uint(0),
        "is-cliff-passed": Cl.bool(false),
        "is-fully-vested": Cl.bool(false)
      });
    });
  });

  describe("Admin Controls", () => {
    it("can set vesting admin", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "set-vesting-admin",
        [Cl.standardPrincipal(wallet1), Cl.bool(true)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can toggle vesting pause", () => {
      const result = simnet.callPublicFn(
        "token-vesting", "toggle-vesting-pause", [], deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
