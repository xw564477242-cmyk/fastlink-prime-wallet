import { describe, expect, it } from "bun:test";
import type { BackendSession, WalletTransferAccount } from "./backend-api";
import {
  initialWalletTransferAccountState,
  walletTransferAccountReducer,
  walletTransferAccountScopeKey,
  walletTransferAccountView,
} from "./wallet-transfer-account-state";

const now = Date.parse("2026-08-01T00:00:00.000Z");

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-01",
    expiresAt: "2026-08-02T00:00:00.000Z",
    tenantId: "tenant-01",
    customerId: "customer-01",
    environment: "SANDBOX",
    ...overrides,
  };
}

const account: WalletTransferAccount = {
  id: "account-source-01",
  assetCode: "USD",
  status: "active",
  currentBalance: "100",
  postedBalance: "100",
  pendingBalance: "0",
  availableBalance: "100",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Internal transfer account request state", () => {
  it("binds actor, expiry, tenant, customer, session environment and runtime", () => {
    const baseline = walletTransferAccountScopeKey(session(), "SANDBOX", now);
    expect(baseline).not.toBeNull();
    for (const changed of [
      session({ actorId: "actor-02" }),
      session({ expiresAt: "2026-08-03T00:00:00.000Z" }),
      session({ tenantId: "tenant-02" }),
      session({ customerId: "customer-02" }),
      session({ environment: "TEST" }),
    ]) {
      expect(walletTransferAccountScopeKey(changed, changed.environment, now)).not.toBe(baseline);
    }
    expect(walletTransferAccountScopeKey(session(), "TEST", now)).toBeNull();
    expect(
      walletTransferAccountScopeKey(
        session({ expiresAt: "2026-08-01T00:00:00.000Z" }),
        "SANDBOX",
        now,
      ),
    ).toBeNull();
    expect(
      walletTransferAccountScopeKey(session({ environment: "PRODUCTION" }), "PRODUCTION", now),
    ).toBeNull();
  });

  it("synchronously hides the old account list before an effect reset", () => {
    const oldScope = walletTransferAccountScopeKey(session(), "SANDBOX", now)!;
    const newScope = walletTransferAccountScopeKey(
      session({ actorId: "actor-02" }),
      "SANDBOX",
      now,
    )!;
    const previous = {
      ...initialWalletTransferAccountState,
      scopeKey: oldScope,
      requestKey: "request-old",
      accounts: [account],
    };
    expect(walletTransferAccountView(previous, newScope)).toEqual({
      ...initialWalletTransferAccountState,
      scopeKey: newScope,
      loading: true,
    });
  });

  it("rejects stale success, error and finally after a scope generation change", () => {
    const scope = walletTransferAccountScopeKey(session(), "SANDBOX", now)!;
    const current = walletTransferAccountReducer(initialWalletTransferAccountState, {
      type: "reset",
      scopeKey: scope,
      requestKey: "request-new",
    });
    expect(
      walletTransferAccountReducer(current, {
        type: "loaded",
        requestKey: "request-old",
        accounts: [account],
      }),
    ).toBe(current);
    expect(
      walletTransferAccountReducer(current, { type: "failed", requestKey: "request-old" }),
    ).toBe(current);
    expect(
      walletTransferAccountReducer(current, { type: "settled", requestKey: "request-old" }),
    ).toBe(current);
  });
});
