import { describe, expect, it } from "bun:test";
import type { BackendSession, WalletAccountTransaction } from "./backend-api";
import {
  initialWalletTransactionDetailState,
  walletTransactionDetailErrorMessage,
  walletTransactionDetailReducer,
  walletTransactionDetailRequestKey,
  walletTransactionDetailScopeKey,
  walletTransactionDetailViewForScope,
  walletTransactionPublicVersion,
} from "./wallet-transaction-detail-state";

const session: BackendSession = {
  actorId: "actor-wallet-detail",
  tenantId: "tenant-wallet-detail",
  customerId: "customer-wallet-detail",
  environment: "SANDBOX",
  expiresAt: "2099-08-01T00:00:00.000Z",
};

const detail: WalletAccountTransaction = {
  id: "wallet-txn-1",
  type: "transfer",
  status: "completed",
  assetCode: "USD",
  amount: "25.5",
  direction: "outgoing",
  createdAt: "2026-07-31T12:00:00.000Z",
  updatedAt: "2026-07-31T12:00:01.000Z",
};

function scope(
  currentSession: BackendSession | null = session,
  transaction: WalletAccountTransaction | null = detail,
  historyScope = "wallet-history-filter-scope-v1",
) {
  return walletTransactionDetailScopeKey(currentSession, "USD", transaction, historyScope);
}

describe("Wallet transaction detail state", () => {
  it("binds filter scope, complete session and every selected transaction public version field", () => {
    const base = scope();
    expect(base).not.toBeNull();
    const sessionChanges: BackendSession[] = [
      { ...session, actorId: "actor-other" },
      { ...session, expiresAt: "2099-08-02T00:00:00.000Z" },
      { ...session, tenantId: "tenant-other" },
      { ...session, customerId: "customer-other" },
      { ...session, environment: "TEST" },
    ];
    for (const changed of sessionChanges) expect(scope(changed)).not.toBe(base);
    expect(scope(session, detail, "wallet-history-filter-scope-v2")).not.toBe(base);
    expect(walletTransactionDetailScopeKey(session, "EUR", detail, "history")).toBeNull();

    const publicChanges: WalletAccountTransaction[] = [
      { ...detail, id: "wallet-txn-2" },
      { ...detail, type: "refund" },
      { ...detail, status: "reversed" },
      { ...detail, assetCode: "EUR" },
      { ...detail, amount: "25.6" },
      { ...detail, direction: "incoming" },
      { ...detail, createdAt: "2026-07-31T12:00:02.000Z" },
      { ...detail, updatedAt: "2026-07-31T12:00:03.000Z" },
    ];
    for (const changed of publicChanges) {
      const selectedAsset = changed.assetCode;
      expect(walletTransactionDetailScopeKey(session, selectedAsset, changed, "history")).not.toBe(
        base,
      );
    }
    expect(JSON.parse(walletTransactionPublicVersion(detail))).toHaveLength(8);
  });

  it("synchronously hides old detail when scope changes", () => {
    const previous = {
      ...initialWalletTransactionDetailState,
      scopeKey: "scope-old",
      activeRequestKey: walletTransactionDetailRequestKey("scope-old", 7),
      detail,
      error: "foreign error",
    };
    expect(walletTransactionDetailViewForScope(previous, "scope-new")).toEqual({
      ...initialWalletTransactionDetailState,
      scopeKey: "scope-new",
      loading: true,
      scopeReady: false,
    });
  });

  it("rejects stale success, error and finally after scope or generation changes", () => {
    const currentScope = "scope-current";
    const currentRequest = walletTransactionDetailRequestKey(currentScope, 2);
    const staleRequest = walletTransactionDetailRequestKey(currentScope, 1);
    const reset = walletTransactionDetailReducer(initialWalletTransactionDetailState, {
      type: "reset",
      scopeKey: currentScope,
    });
    const current = walletTransactionDetailReducer(reset, {
      type: "begin",
      scopeKey: currentScope,
      requestKey: currentRequest,
    });
    expect(
      walletTransactionDetailReducer(current, {
        type: "loaded",
        requestKey: staleRequest,
        detail,
      }),
    ).toBe(current);
    expect(
      walletTransactionDetailReducer(current, {
        type: "failed",
        requestKey: staleRequest,
        message: "foreign error",
      }),
    ).toBe(current);
    expect(
      walletTransactionDetailReducer(current, { type: "settled", requestKey: staleRequest }),
    ).toBe(current);
  });

  it("accepts and settles only the active manual refresh", () => {
    const currentScope = "scope-current";
    const requestKey = walletTransactionDetailRequestKey(currentScope, 3);
    const reset = walletTransactionDetailReducer(initialWalletTransactionDetailState, {
      type: "reset",
      scopeKey: currentScope,
    });
    const loading = walletTransactionDetailReducer(reset, {
      type: "begin",
      scopeKey: currentScope,
      requestKey,
    });
    expect(loading.detail).toBeNull();
    expect(loading.loading).toBeTrue();
    const loaded = walletTransactionDetailReducer(loading, {
      type: "loaded",
      requestKey,
      detail,
    });
    expect(loaded.detail).toEqual(detail);
    expect(
      walletTransactionDetailReducer(loaded, { type: "settled", requestKey }).loading,
    ).toBeFalse();
  });

  it("uses one safe message for 404, out-of-scope and network failures", () => {
    for (const reason of [
      new Error("HTTP 404 account internal"),
      new Error("HTTP 403 provider detail"),
      null,
    ]) {
      expect(walletTransactionDetailErrorMessage(reason)).toBe(
        "Wallet transaction detail is unavailable",
      );
    }
  });
});
