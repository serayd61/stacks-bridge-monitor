import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Bridge Token (SIP-010)", () => {
  describe("Token Metadata", () => {
    it("returns correct name", () => {
      const result = simnet.callReadOnlyFn("bridge-token", "get-name", [], deployer);
      expect(result.result).toBeOk(Cl.stringAscii("Bridge Token"));
    });

    it("returns correct symbol", () => {
      const result = simnet.callReadOnlyFn("bridge-token", "get-symbol", [], deployer);
      expect(result.result).toBeOk(Cl.stringAscii("BRIDGE"));
    });

    it("returns correct decimals", () => {
      const result = simnet.callReadOnlyFn("bridge-token", "get-decimals", [], deployer);
      expect(result.result).toBeOk(Cl.uint(6));
    });

    it("returns token URI", () => {
      const result = simnet.callReadOnlyFn("bridge-token", "get-token-uri", [], deployer);
      expect(result.result).toBeOk(
        Cl.some(Cl.stringUtf8("https://stacks-bridge-monitor.vercel.app/token-metadata.json"))
      );
    });

    it("initial total supply is 0", () => {
      const result = simnet.callReadOnlyFn("bridge-token", "get-total-supply", [], deployer);
      expect(result.result).toBeOk(Cl.uint(0));
    });
  });

  describe("Minting", () => {
    it("deployer can mint tokens", () => {
      const result = simnet.callPublicFn(
        "bridge-token", "mint",
        [Cl.uint(1000000), Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      const balance = simnet.callReadOnlyFn("bridge-token", "get-balance", [Cl.standardPrincipal(wallet1)], deployer);
      expect(balance.result).toBeOk(Cl.uint(1000000));
    });

    it("non-authorized cannot mint", () => {
      const result = simnet.callPublicFn(
        "bridge-token", "mint",
        [Cl.uint(1000000), Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1001));
    });

    it("cannot mint 0 tokens", () => {
      const result = simnet.callPublicFn(
        "bridge-token", "mint",
        [Cl.uint(0), Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(1003));
    });

    it("tracks total minted", () => {
      simnet.callPublicFn("bridge-token", "mint", [Cl.uint(5000000), Cl.standardPrincipal(wallet1)], deployer);
      const result = simnet.callReadOnlyFn("bridge-token", "get-total-minted", [], deployer);
      expect(result.result).toBe(Cl.uint(5000000));
    });
  });

  describe("Transfers", () => {
    it("can transfer tokens", () => {
      simnet.callPublicFn("bridge-token", "mint", [Cl.uint(1000000), Cl.standardPrincipal(wallet1)], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "transfer",
        [Cl.uint(500000), Cl.standardPrincipal(wallet1), Cl.standardPrincipal(wallet2), Cl.none()],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("cannot transfer more than balance", () => {
      simnet.callPublicFn("bridge-token", "mint", [Cl.uint(100), Cl.standardPrincipal(wallet1)], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "transfer",
        [Cl.uint(200), Cl.standardPrincipal(wallet1), Cl.standardPrincipal(wallet2), Cl.none()],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(1));
    });

    it("cannot transfer on behalf of others", () => {
      simnet.callPublicFn("bridge-token", "mint", [Cl.uint(1000000), Cl.standardPrincipal(wallet1)], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "transfer",
        [Cl.uint(500000), Cl.standardPrincipal(wallet1), Cl.standardPrincipal(wallet2), Cl.none()],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(1001));
    });
  });

  describe("Burning", () => {
    it("user can burn own tokens", () => {
      simnet.callPublicFn("bridge-token", "mint", [Cl.uint(1000000), Cl.standardPrincipal(wallet1)], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "burn",
        [Cl.uint(500000), Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Admin Controls", () => {
    it("can pause minting", () => {
      simnet.callPublicFn("bridge-token", "toggle-minting-pause", [], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "mint",
        [Cl.uint(1000000), Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(1004));
    });

    it("can add authorized minters", () => {
      simnet.callPublicFn("bridge-token", "set-minter", [Cl.standardPrincipal(wallet1), Cl.bool(true)], deployer);
      const result = simnet.callPublicFn(
        "bridge-token", "mint",
        [Cl.uint(1000000), Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});
