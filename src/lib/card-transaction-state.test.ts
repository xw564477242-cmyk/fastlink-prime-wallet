import { describe, expect, it } from "bun:test";
import type { WalletCardTransaction } from "./backend-api";
import {
  CARD_TRANSACTION_PAGINATION_ERROR,
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "./card-transaction-state";

const transaction = (id: string): WalletCardTransaction => ({
  id,
  status: "settled",
  amountMinor: "2500",
  currency: "USD",
  merchant: "Coffee",
  category: "5812",
  timestamp: "2026-07-31T12:00:00.000Z",
});

describe("Card transaction state", () => {
  it("synchronously hides transactions when actor, expiry, tenant, customer, environment or Card changes", () => {
    const previous = {
      ...initialCardTransactionState,
      scopeKey: '["actor-a","2099-08-01T08:00:00.000Z","tenant-a","customer-a","SANDBOX","card-a"]',
      activeRequestKey: "request-7",
      transactions: [transaction("foreign-transaction")],
      nextCursor: "foreign-cursor",
      seenCursors: ["foreign-cursor"],
      loadingMore: true,
      error: "foreign-error",
    };

    expect(
      cardTransactionViewForScope(
        previous,
        '["actor-b","2099-08-01T09:00:00.000Z","tenant-b","customer-b","UAT","card-b"]',
      ),
    ).toEqual({
      ...initialCardTransactionState,
      scopeKey: '["actor-b","2099-08-01T09:00:00.000Z","tenant-b","customer-b","UAT","card-b"]',
      loading: true,
      scopeReady: false,
    });
  });

  it("clears the previous selected Card and cursor history during reset", () => {
    const loaded = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-a",
      transactions: [transaction("txn-a")],
      nextCursor: "cursor-a",
      seenCursors: ["cursor-a"],
    };

    expect(
      cardTransactionReducer(loaded, {
        type: "reset",
        scopeKey: "scope-card-b",
        requestKey: "request-b",
        loading: true,
      }),
    ).toEqual({
      scopeKey: "scope-card-b",
      activeRequestKey: "request-b",
      transactions: [],
      nextCursor: null,
      seenCursors: [],
      loading: true,
      loadingMore: false,
      refreshing: false,
      error: null,
      refreshError: null,
    });
  });

  it("deterministically rejects a stale response after scope generation changes", () => {
    const current = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: "scope-card-b",
      requestKey: "request-b",
      loading: true,
    });
    const stalePage = cardTransactionReducer(current, {
      type: "page",
      requestKey: "request-a",
      requestCursor: null,
      page: { transactions: [transaction("foreign-transaction")], nextCursor: "foreign-cursor" },
      append: false,
    });
    const staleFailure = cardTransactionReducer(current, {
      type: "failed",
      requestKey: "request-a",
      message: "foreign failure",
      append: false,
    });
    const staleFinally = cardTransactionReducer(current, {
      type: "settled",
      requestKey: "request-a",
    });

    expect(stalePage).toBe(current);
    expect(staleFailure).toBe(current);
    expect(staleFinally).toBe(current);
    expect(current.transactions).toEqual([]);
  });

  it("appends a consistent page and records its forward cursor", () => {
    const loaded = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-2",
      transactions: [transaction("txn-2"), transaction("txn-1")],
      nextCursor: "cursor-2",
      seenCursors: ["cursor-2"],
    };
    const loadingMore = cardTransactionReducer(loaded, {
      type: "loading-more",
      requestKey: "request-3",
      requestCursor: "cursor-2",
    });
    const next = cardTransactionReducer(loadingMore, {
      type: "page",
      requestKey: "request-3",
      requestCursor: "cursor-2",
      page: { transactions: [transaction("txn-0")], nextCursor: "cursor-3" },
      append: true,
    });

    expect(next.transactions.map((item) => item.id)).toEqual(["txn-2", "txn-1", "txn-0"]);
    expect(next.nextCursor).toBe("cursor-3");
    expect(next.seenCursors).toEqual(["cursor-2", "cursor-3"]);
    expect(next.loadingMore).toBeFalse();
  });

  it("fails closed rather than overwriting an existing transaction", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-4",
      transactions: [transaction("txn-1")],
      nextCursor: "cursor-1",
      seenCursors: ["cursor-1"],
      loadingMore: true,
    };
    const failed = cardTransactionReducer(current, {
      type: "page",
      requestKey: "request-4",
      requestCursor: "cursor-1",
      page: { transactions: [transaction("txn-1")], nextCursor: "cursor-2" },
      append: true,
    });

    expect(failed.transactions).toEqual(current.transactions);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("preserves validated current-scope rows but closes pagination after a transport failure", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-4",
      transactions: [transaction("txn-1")],
      nextCursor: "retry-cursor",
      seenCursors: ["retry-cursor"],
      loadingMore: true,
    };
    const failed = cardTransactionReducer(current, {
      type: "failed",
      requestKey: "request-4",
      message: "temporary failure",
      append: true,
    });

    expect(failed.transactions.map((item) => item.id)).toEqual(["txn-1"]);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe("temporary failure");
  });

  it("preserves the verified snapshot while refreshing and atomically replaces its first page", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-loaded",
      transactions: [transaction("txn-old-2"), transaction("txn-old-1")],
      nextCursor: "cursor-old",
      seenCursors: ["cursor-old", "cursor-older"],
    };
    const refreshing = cardTransactionReducer(current, {
      type: "refreshing",
      scopeKey: "scope-card-a",
      requestKey: "request-refresh",
    });

    expect(refreshing.transactions).toEqual(current.transactions);
    expect(refreshing.nextCursor).toBe("cursor-old");
    expect(refreshing.refreshing).toBeTrue();

    const refreshed = cardTransactionReducer(refreshing, {
      type: "refreshed",
      requestKey: "request-refresh",
      page: { transactions: [transaction("txn-new-1")], nextCursor: "cursor-new" },
    });
    expect(refreshed.transactions.map(({ id }) => id)).toEqual(["txn-new-1"]);
    expect(refreshed.nextCursor).toBe("cursor-new");
    expect(refreshed.seenCursors).toEqual(["cursor-new"]);
    expect(refreshed.refreshing).toBeFalse();
    expect(refreshed.refreshError).toBeNull();
  });

  it("keeps the verified snapshot and public retry state after refresh failure", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      activeRequestKey: "request-refresh",
      transactions: [transaction("txn-old")],
      nextCursor: "cursor-old",
      seenCursors: ["cursor-old"],
      refreshing: true,
    };
    const failed = cardTransactionReducer(current, {
      type: "refresh-failed",
      requestKey: "request-refresh",
      message: "Card transaction history refresh failed",
    });

    expect(failed.transactions).toEqual(current.transactions);
    expect(failed.nextCursor).toBe("cursor-old");
    expect(failed.seenCursors).toEqual(["cursor-old"]);
    expect(failed.refreshing).toBeFalse();
    expect(failed.refreshError).toBe("Card transaction history refresh failed");
  });

  it("rejects an invalid or stale refresh without polluting the current Card scope", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-b",
      activeRequestKey: "request-current",
      transactions: [transaction("txn-current")],
      nextCursor: "cursor-current",
    };
    const wrongScope = cardTransactionReducer(current, {
      type: "refreshing",
      scopeKey: "scope-card-a",
      requestKey: "request-stale",
    });
    const staleResult = cardTransactionReducer(current, {
      type: "refreshed",
      requestKey: "request-stale",
      page: { transactions: [transaction("txn-stale")], nextCursor: "cursor-stale" },
    });

    expect(wrongScope).toBe(current);
    expect(staleResult).toBe(current);

    const refreshing = cardTransactionReducer(current, {
      type: "refreshing",
      scopeKey: "scope-card-b",
      requestKey: "request-refresh",
    });
    const invalid = cardTransactionReducer(refreshing, {
      type: "refreshed",
      requestKey: "request-refresh",
      page: {
        transactions: [transaction("txn-duplicate"), transaction("txn-duplicate")],
        nextCursor: "cursor-new",
      },
    });
    expect(invalid.transactions).toEqual(current.transactions);
    expect(invalid.nextCursor).toBe("cursor-current");
    expect(invalid.refreshError).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("binds request identity to scope, cursor and generation", () => {
    expect(cardTransactionRequestKey("scope", "cursor-1", 7)).not.toBe(
      cardTransactionRequestKey("scope", "cursor-1", 8),
    );
    expect(cardTransactionRequestKey("scope", "cursor-1", 7)).not.toBe(
      cardTransactionRequestKey("scope", "cursor-2", 7),
    );
    const allScope = JSON.stringify(["actor", "tenant", "card", 1, "ALL"]);
    const declinedScope = JSON.stringify(["actor", "tenant", "card", 1, "DECLINED"]);
    expect(cardTransactionRequestKey(allScope, null, 7)).not.toBe(
      cardTransactionRequestKey(declinedScope, null, 7),
    );
  });
});
