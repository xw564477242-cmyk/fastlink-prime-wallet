import { describe, expect, it } from "bun:test";
import type { WalletAccountTransaction } from "./backend-api";
import {
  initialWalletTransactionState,
  walletTransactionReducer,
  walletTransactionRequestKey,
  walletTransactionViewForScope,
} from "./wallet-transaction-state";

function transaction(id: string, assetCode = "USD"): WalletAccountTransaction {
  return {
    id,
    type: "transfer",
    status: "completed",
    assetCode,
    amount: "25.5",
    direction: "outgoing",
    createdAt: "2026-07-31T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:01.000Z",
  };
}

const scope = (environment = "TEST", tenant = "tenant-a", assetCode = "USD") =>
  JSON.stringify([
    "actor-a",
    "2099-08-01T00:00:00.000Z",
    tenant,
    "customer-a",
    environment,
    assetCode,
    "wallet-transaction-filters-v1",
    "TRANSFER",
    "COMPLETED",
  ]);

function loadedState() {
  const scopeKey = scope();
  return {
    ...initialWalletTransactionState,
    scopeKey,
    activeRequestKey: walletTransactionRequestKey(scopeKey, "cursor-page-2", 3),
    items: [transaction("tx-page-1"), transaction("tx-page-2")],
    nextCursor: "cursor-page-3",
    seenCursors: ["cursor-page-2", "cursor-page-3"],
  };
}

describe("Wallet transaction manual refresh adversarial state", () => {
  it("invalidates pagination immediately while retaining the visible snapshot", () => {
    const loaded = loadedState();
    const refreshKey = walletTransactionRequestKey(loaded.scopeKey!, null, 4);
    const refreshing = walletTransactionReducer(loaded, {
      type: "refreshing",
      scopeKey: loaded.scopeKey!,
      requestKey: refreshKey,
    });

    expect(refreshing.items).toEqual(loaded.items);
    expect(refreshing.nextCursor).toBe("cursor-page-3");
    expect(refreshing.activeRequestKey).toBe(refreshKey);
    expect(refreshing.refreshing).toBe(true);
    expect(
      walletTransactionReducer(refreshing, {
        type: "page",
        requestKey: loaded.activeRequestKey!,
        requestCursor: "cursor-page-2",
        page: { items: [transaction("tx-stale-page")], nextCursor: null },
        append: true,
      }),
    ).toBe(refreshing);
  });

  it("keeps rows and pagination intact when the current refresh fails", () => {
    const loaded = loadedState();
    const refreshKey = walletTransactionRequestKey(loaded.scopeKey!, null, 4);
    const refreshing = walletTransactionReducer(loaded, {
      type: "refreshing",
      scopeKey: loaded.scopeKey!,
      requestKey: refreshKey,
    });
    const failed = walletTransactionReducer(refreshing, {
      type: "refresh-failed",
      requestKey: refreshKey,
      message: "Wallet transaction history refresh failed",
    });

    expect(failed.items).toEqual(loaded.items);
    expect(failed.nextCursor).toBe(loaded.nextCursor);
    expect(failed.seenCursors).toEqual(loaded.seenCursors);
    expect(failed.refreshing).toBe(false);
    expect(failed.refreshError).toBe("Wallet transaction history refresh failed");
  });

  it("commits one validated first page and resets the cursor chain only after success", () => {
    const loaded = loadedState();
    const refreshKey = walletTransactionRequestKey(loaded.scopeKey!, null, 4);
    const refreshing = walletTransactionReducer(loaded, {
      type: "refreshing",
      scopeKey: loaded.scopeKey!,
      requestKey: refreshKey,
    });
    const refreshed = walletTransactionReducer(refreshing, {
      type: "refreshed",
      requestKey: refreshKey,
      page: { items: [transaction("tx-refreshed")], nextCursor: "cursor-refreshed-page-2" },
    });

    expect(refreshed.items.map((item) => item.id)).toEqual(["tx-refreshed"]);
    expect(refreshed.nextCursor).toBe("cursor-refreshed-page-2");
    expect(refreshed.seenCursors).toEqual(["cursor-refreshed-page-2"]);
    expect(refreshed.refreshing).toBe(false);
    expect(refreshed.refreshError).toBeNull();
  });

  it("rejects stale refresh success, failure and finally across tenant, environment and account scopes", () => {
    const loaded = loadedState();
    const refreshKey = walletTransactionRequestKey(loaded.scopeKey!, null, 4);
    const refreshing = walletTransactionReducer(loaded, {
      type: "refreshing",
      scopeKey: loaded.scopeKey!,
      requestKey: refreshKey,
    });

    for (const nextScope of [
      scope("TEST", "tenant-b"),
      scope("SANDBOX"),
      scope("TEST", "tenant-a", "EUR"),
    ]) {
      const currentKey = walletTransactionRequestKey(nextScope, null, 5);
      const current = walletTransactionReducer(refreshing, {
        type: "reset",
        scopeKey: nextScope,
        requestKey: currentKey,
        loading: true,
      });
      expect(
        walletTransactionReducer(current, {
          type: "refreshed",
          requestKey: refreshKey,
          page: { items: [transaction("tx-cross-scope-secret")], nextCursor: null },
        }),
      ).toBe(current);
      expect(
        walletTransactionReducer(current, {
          type: "refresh-failed",
          requestKey: refreshKey,
          message: "cross-scope failure",
        }),
      ).toBe(current);
      expect(walletTransactionReducer(current, { type: "settled", requestKey: refreshKey })).toBe(
        current,
      );
      expect(JSON.stringify(walletTransactionViewForScope(refreshing, nextScope))).not.toContain(
        "tx-page-1",
      );
    }
  });

  it("fails closed on duplicate refreshed rows without replacing the prior snapshot", () => {
    const loaded = loadedState();
    const refreshKey = walletTransactionRequestKey(loaded.scopeKey!, null, 4);
    const refreshing = walletTransactionReducer(loaded, {
      type: "refreshing",
      scopeKey: loaded.scopeKey!,
      requestKey: refreshKey,
    });
    const rejected = walletTransactionReducer(refreshing, {
      type: "refreshed",
      requestKey: refreshKey,
      page: {
        items: [transaction("tx-duplicate"), transaction("tx-duplicate")],
        nextCursor: null,
      },
    });

    expect(rejected.items).toEqual(loaded.items);
    expect(rejected.nextCursor).toBe(loaded.nextCursor);
    expect(rejected.refreshing).toBe(false);
    expect(rejected.refreshError).toBe(
      "Backend returned inconsistent Wallet transaction pagination",
    );
  });
});
