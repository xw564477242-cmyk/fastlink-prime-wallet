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
  it("synchronously hides transactions when actor, tenant, customer, environment or Card changes", () => {
    const previous = {
      ...initialCardTransactionState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","card-a"]',
      activeRequestKey: "request-7",
      transactions: [transaction("foreign-transaction")],
      nextCursor: "foreign-cursor",
      seenCursors: ["foreign-cursor"],
      loadingMore: true,
      error: "foreign-error",
    };

    expect(
      cardTransactionViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT","card-b"]'),
    ).toEqual({
      ...initialCardTransactionState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","card-b"]',
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
      error: null,
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

    expect(stalePage).toBe(current);
    expect(staleFailure).toBe(current);
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

  it("preserves validated current-scope rows when a transport failure occurs", () => {
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
    expect(failed.nextCursor).toBe("retry-cursor");
    expect(failed.error).toBe("temporary failure");
  });

  it("binds request identity to scope, cursor and generation", () => {
    expect(cardTransactionRequestKey("scope", "cursor-1", 7)).not.toBe(
      cardTransactionRequestKey("scope", "cursor-1", 8),
    );
    expect(cardTransactionRequestKey("scope", "cursor-1", 7)).not.toBe(
      cardTransactionRequestKey("scope", "cursor-2", 7),
    );
  });
});
