import { describe, expect, it } from "bun:test";
import type { WalletCardTransaction } from "./backend-api";
import {
  cardTransactionReducer,
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
      requestId: 7,
      transactions: [transaction("foreign-transaction")],
      nextCursor: "foreign-cursor",
      loadingMore: true,
      error: "foreign-error",
    };

    expect(
      cardTransactionViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT","card-b"]'),
    ).toEqual({
      ...initialCardTransactionState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","card-b"]',
      requestId: 7,
      loading: true,
      scopeReady: false,
    });
  });

  it("clears the previous selected Card during reset", () => {
    const loaded = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      requestId: 1,
      transactions: [transaction("txn-a")],
      nextCursor: "cursor-a",
    };

    expect(
      cardTransactionReducer(loaded, {
        type: "reset",
        scopeKey: "scope-card-b",
        requestId: 2,
        loading: true,
      }),
    ).toEqual({
      scopeKey: "scope-card-b",
      requestId: 2,
      transactions: [],
      nextCursor: null,
      loading: true,
      loadingMore: false,
      error: null,
    });
  });

  it("deterministically rejects a stale response after scope generation changes", () => {
    const current = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: "scope-card-b",
      requestId: 2,
      loading: true,
    });
    const stalePage = cardTransactionReducer(current, {
      type: "page",
      requestId: 1,
      page: { transactions: [transaction("foreign-transaction")], nextCursor: "foreign-cursor" },
      append: false,
    });
    const staleFailure = cardTransactionReducer(current, {
      type: "failed",
      requestId: 1,
      message: "foreign failure",
      append: false,
    });

    expect(stalePage).toBe(current);
    expect(staleFailure).toBe(current);
    expect(current.transactions).toEqual([]);
  });

  it("appends explicit pages without duplicating transactions", () => {
    const loaded = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      requestId: 2,
      transactions: [transaction("txn-2"), transaction("txn-1")],
      nextCursor: "cursor-2",
    };
    const loadingMore = cardTransactionReducer(loaded, { type: "loading-more", requestId: 3 });
    const next = cardTransactionReducer(loadingMore, {
      type: "page",
      requestId: 3,
      page: { transactions: [transaction("txn-1"), transaction("txn-0")], nextCursor: null },
      append: true,
    });

    expect(next.transactions.map((item) => item.id)).toEqual(["txn-2", "txn-1", "txn-0"]);
    expect(next.nextCursor).toBeNull();
    expect(next.loadingMore).toBeFalse();
  });

  it("preserves validated current-scope rows when a later page fails", () => {
    const current = {
      ...initialCardTransactionState,
      scopeKey: "scope-card-a",
      requestId: 4,
      transactions: [transaction("txn-1")],
      nextCursor: "retry-cursor",
      loadingMore: true,
    };
    const failed = cardTransactionReducer(current, {
      type: "failed",
      requestId: 4,
      message: "temporary failure",
      append: true,
    });

    expect(failed.transactions.map((item) => item.id)).toEqual(["txn-1"]);
    expect(failed.nextCursor).toBe("retry-cursor");
    expect(failed.error).toBe("temporary failure");
  });
});
