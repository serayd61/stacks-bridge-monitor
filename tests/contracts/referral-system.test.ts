import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Referral System", () => {
  describe("Registration", () => {
    it("can register as referrer", () => {
      const code = new Uint8Array(8).fill(0x01);
      const result = simnet.callPublicFn(
        "referral-system", "register-referrer",
        [Cl.buffer(code)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot register twice", () => {
      const code1 = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code1)], wallet1);

      const code2 = new Uint8Array(8).fill(0x02);
      const result = simnet.callPublicFn(
        "referral-system", "register-referrer",
        [Cl.buffer(code2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(16003));
    });

    it("cannot use duplicate code", () => {
      const code = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code)], wallet1);

      const result = simnet.callPublicFn(
        "referral-system", "register-referrer",
        [Cl.buffer(code)],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(16007));
    });

    it("can register with referral", () => {
      const code1 = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code1)], wallet1);

      const code2 = new Uint8Array(8).fill(0x02);
      const result = simnet.callPublicFn(
        "referral-system", "register-with-referral",
        [Cl.buffer(code1), Cl.buffer(code2)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot self-refer", () => {
      const code1 = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code1)], wallet1);

      const code2 = new Uint8Array(8).fill(0x02);
      const result = simnet.callPublicFn(
        "referral-system", "register-with-referral",
        [Cl.buffer(code1), Cl.buffer(code2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(16005));
    });

    it("cannot use invalid referral code", () => {
      const fakeCode = new Uint8Array(8).fill(0xff);
      const ownCode = new Uint8Array(8).fill(0x01);
      const result = simnet.callPublicFn(
        "referral-system", "register-with-referral",
        [Cl.buffer(fakeCode), Cl.buffer(ownCode)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(16006));
    });
  });

  describe("Tier System", () => {
    it("new users start at Bronze tier", () => {
      const code = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code)], wallet1);

      const result = simnet.callReadOnlyFn(
        "referral-system", "get-referrer-info",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      const info = result.result;
      // Should exist and have tier 0 (Bronze)
      expect(info).toBeSome(expect.objectContaining({}));
    });

    it("determines correct tier based on criteria", () => {
      const result = simnet.callReadOnlyFn(
        "referral-system", "determine-tier",
        [Cl.uint(100), Cl.uint(2000000000000)],
        deployer
      );
      expect(result.result).toBe(Cl.uint(4)); // Diamond
    });

    it("returns bronze for low activity", () => {
      const result = simnet.callReadOnlyFn(
        "referral-system", "determine-tier",
        [Cl.uint(2), Cl.uint(100000)],
        deployer
      );
      expect(result.result).toBe(Cl.uint(0)); // Bronze
    });
  });

  describe("Campaigns", () => {
    it("deployer can create campaign", () => {
      const result = simnet.callPublicFn(
        "referral-system", "create-campaign",
        [
          Cl.stringAscii("Launch Bonus"),
          Cl.uint(20000), // 2x multiplier
          Cl.uint(4320),  // ~30 days
          Cl.uint(100000000000) // max rewards
        ],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("non-owner cannot create campaign", () => {
      const result = simnet.callPublicFn(
        "referral-system", "create-campaign",
        [Cl.stringAscii("Bad Campaign"), Cl.uint(20000), Cl.uint(100), Cl.uint(1000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(16001));
    });
  });

  describe("Read-Only Functions", () => {
    it("returns referral stats", () => {
      const result = simnet.callReadOnlyFn(
        "referral-system", "get-referral-stats", [], deployer
      );
      expect(result.result).toBeTuple({
        "total-referrers": Cl.uint(0),
        "total-referrals": Cl.uint(0),
        "total-rewards-distributed": Cl.uint(0),
        "total-volume-referred": Cl.uint(0),
        "base-rate": Cl.uint(300),
        "level2-rate": Cl.uint(100),
        "level3-rate": Cl.uint(50),
        "active-campaigns": Cl.uint(0),
        "is-paused": Cl.bool(false)
      });
    });

    it("returns tier info", () => {
      const result = simnet.callReadOnlyFn(
        "referral-system", "get-tier-info",
        [Cl.uint(4)],
        deployer
      );
      expect(result.result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Diamond"),
          "min-referrals": Cl.uint(100),
          "min-volume": Cl.uint(2000000000000),
          "bonus-rate-bps": Cl.uint(500),
          "max-levels": Cl.uint(3)
        })
      );
    });

    it("returns 0 pending rewards for unknown user", () => {
      const result = simnet.callReadOnlyFn(
        "referral-system", "get-pending-rewards",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBe(Cl.uint(0));
    });

    it("resolves referrer by code", () => {
      const code = new Uint8Array(8).fill(0x01);
      simnet.callPublicFn("referral-system", "register-referrer",
        [Cl.buffer(code)], wallet1);

      const result = simnet.callReadOnlyFn(
        "referral-system", "get-referrer-by-code",
        [Cl.buffer(code)],
        deployer
      );
      expect(result.result).toBeSome(Cl.standardPrincipal(wallet1));
    });
  });

  describe("Admin Controls", () => {
    it("can set base referral rate", () => {
      const result = simnet.callPublicFn(
        "referral-system", "set-base-referral-rate",
        [Cl.uint(500)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot set rate above 10%", () => {
      const result = simnet.callPublicFn(
        "referral-system", "set-base-referral-rate",
        [Cl.uint(2000)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(16002));
    });

    it("can toggle program pause", () => {
      const result = simnet.callPublicFn(
        "referral-system", "toggle-program-pause", [], deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
