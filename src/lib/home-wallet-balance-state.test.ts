import { describe, expect, it } from "bun:test";
import type { BackendSession, WalletAssetAccount } from "./backend-api";
import {
  homeWalletBalanceReadAllowed,
  homeWalletBalanceReducer,
  homeWalletBalanceScopeKey,
  homeWalletBalanceView,
  initialHomeWalletBalanceState,
} from "./home-wallet-balance-state";

const now = Date.parse("2026-08-01T00:00:00.000Z");
const account: WalletAssetAccount = {
  assetCode: "USD",
  availableBalance: "100",
  ledgerBalance: "105",
  pendingBalance: "5",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-home-balance",
    expiresAt: "2026-08-02T00:00:00.000Z",
    tenantId: "tenant-home-balance",
    customerId: "customer-home-balance",
    environment: "SANDBOX",
    ...overrides,
  };
}

describe("Home Wallet balance state", () => {
  it("allows only same-origin /api with a matching unexpired SANDBOX or TEST session", () => {
    expect(homeWalletBalanceReadAllowed(session(), "SANDBOX", "/api", now)).toBeTrue();
    expect(
      homeWalletBalanceReadAllowed(session(), "SANDBOX", "https://api.example", now),
    ).toBeFalse();
    expect(homeWalletBalanceReadAllowed(session(), "TEST", "/api", now)).toBeFalse();
    expect(
      homeWalletBalanceReadAllowed(
        session({ expiresAt: "2026-08-01T00:00:00.000Z" }),
        "SANDBOX",
        "/api",
        now,
      ),
    ).toBeFalse();
    expect(
      homeWalletBalanceReadAllowed(
        session({ environment: "PRODUCTION" }),
        "PRODUCTION",
        "/api",
        now,
      ),
    ).toBeFalse();
  });

  it("binds exact identity, expiry, environment and Session object generation", () => {
    const first = homeWalletBalanceScopeKey(session(), "SANDBOX", "/api", now, 1);
    expect(first).not.toBeNull();
    expect(homeWalletBalanceScopeKey(session(), "SANDBOX", "/api", now, 2)).not.toBe(first);
    expect(
      homeWalletBalanceScopeKey(
        session({ customerId: "customer-other" }),
        "SANDBOX",
        "/api",
        now,
        1,
      ),
    ).not.toBe(first);
  });

  it("synchronously hides a prior scope before effects settle", () => {
    const previous = {
      ...initialHomeWalletBalanceState,
      scopeKey: "scope-old",
      requestKey: "request-old",
      accounts: [account],
    };
    expect(homeWalletBalanceView(previous, "scope-new")).toEqual({
      ...initialHomeWalletBalanceState,
      scopeKey: "scope-new",
      loading: true,
      scopeReady: false,
    });
  });

  it("keeps a verified snapshot only for an explicitly retained refresh failure", () => {
    const refreshing = {
      ...initialHomeWalletBalanceState,
      scopeKey: "scope-current",
      requestKey: "request-current",
      accounts: [account],
      refreshing: true,
    };
    const retained = homeWalletBalanceReducer(refreshing, {
      type: "failed",
      requestKey: "request-current",
      mode: "refresh",
      retainSnapshot: true,
    });
    expect(retained.accounts).toEqual([account]);
    expect(retained.error).toBeNull();
    expect(retained.refreshError).toBe("Wallet balance refresh failed");
  });

  it("fails closed for current authorization, client and parser failures", () => {
    const current = {
      ...initialHomeWalletBalanceState,
      scopeKey: "scope-current",
      requestKey: "request-current",
      accounts: [account],
      refreshing: true,
    };
    const failed = homeWalletBalanceReducer(current, {
      type: "failed",
      requestKey: "request-current",
      mode: "refresh",
      retainSnapshot: false,
    });
    expect(failed.accounts).toEqual([]);
    expect(failed.error).toBe("Wallet balances are unavailable");
    expect(failed.refreshError).toBeNull();
  });

  it("rejects stale success, failure and finally actions", () => {
    const current = {
      ...initialHomeWalletBalanceState,
      scopeKey: "scope-current",
      requestKey: "request-current",
      loading: true,
    };
    expect(
      homeWalletBalanceReducer(current, {
        type: "loaded",
        requestKey: "request-old",
        accounts: [account],
      }),
    ).toBe(current);
    expect(
      homeWalletBalanceReducer(current, {
        type: "failed",
        requestKey: "request-old",
        mode: "initial",
        retainSnapshot: false,
      }),
    ).toBe(current);
    expect(homeWalletBalanceReducer(current, { type: "settled", requestKey: "request-old" })).toBe(
      current,
    );
  });
});
