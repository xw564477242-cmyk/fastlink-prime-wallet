import { describe, expect, it } from "bun:test";
import type { WalletOperationActivity } from "./backend-api";
import {
  initialWalletOperationState,
  walletOperationErrorMessage,
  walletOperationReducer,
  walletOperationRequestKey,
  walletOperationViewForScope,
} from "./wallet-operation-state";

const operation = (id: string): WalletOperationActivity => ({
  id,
  type: "deposit",
  status: "completed",
  assetCode: "USD",
  amount: "25.5",
  direction: "incoming",
  createdAt: "2026-07-31T12:00:00Z",
  completedAt: "2026-07-31T12:00:01Z",
  updatedAt: "2026-07-31T12:00:01Z",
});

describe("Wallet operation activity state", () => {
  const filterKey = '[1,"ALL","ALL"]';
  it("synchronously hides rows when actor, tenant, customer or environment changes", () => {
    const previous = {
      ...initialWalletOperationState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX"]',
      filterKey,
      activeRequestKey: "old-request",
      items: [operation("foreign")],
      nextCursor: "foreign-cursor",
    };
    expect(
      walletOperationViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT"]', filterKey),
    ).toEqual({
      ...initialWalletOperationState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT"]',
      filterKey,
      loading: true,
      scopeReady: false,
    });
  });

  it("binds scope, cursor and generation into each request key", () => {
    const first = walletOperationRequestKey("scope", filterKey, null, 1);
    expect(first).not.toBe(walletOperationRequestKey("scope", filterKey, "cursor-1", 1));
    expect(first).not.toBe(walletOperationRequestKey("scope", filterKey, null, 2));
    expect(first).not.toBe(walletOperationRequestKey("other-scope", filterKey, null, 1));
  });

  it("rejects stale success, error and finally actions", () => {
    const current = walletOperationReducer(initialWalletOperationState, {
      type: "reset",
      scopeKey: "scope-current",
      filterKey,
      requestKey: "request-current",
      loading: true,
    });
    expect(
      walletOperationReducer(current, {
        type: "page",
        requestKey: "request-stale",
        requestCursor: null,
        page: { items: [operation("foreign")], nextCursor: "foreign-cursor" },
        append: false,
      }),
    ).toBe(current);
    expect(
      walletOperationReducer(current, {
        type: "failed",
        requestKey: "request-stale",
        message: "foreign error",
        append: false,
      }),
    ).toBe(current);
    expect(walletOperationReducer(current, { type: "settled", requestKey: "request-stale" })).toBe(
      current,
    );
  });

  it("appends one cursor page and then settles the exact request", () => {
    const loaded = {
      ...initialWalletOperationState,
      scopeKey: "scope",
      filterKey,
      activeRequestKey: "request-1",
      items: [operation("operation-2")],
      nextCursor: "cursor-1",
      cursorTrail: ["cursor-1"],
    };
    const loading = walletOperationReducer(loaded, {
      type: "loading-more",
      requestKey: "request-2",
      requestCursor: "cursor-1",
    });
    const paged = walletOperationReducer(loading, {
      type: "page",
      requestKey: "request-2",
      requestCursor: "cursor-1",
      page: { items: [operation("operation-1")], nextCursor: null },
      append: true,
    });
    expect(paged.items.map((item) => item.id)).toEqual(["operation-2", "operation-1"]);
    expect(paged.loadingMore).toBe(false);
    expect(
      walletOperationReducer(paged, { type: "settled", requestKey: "request-2" }).loadingMore,
    ).toBe(false);
  });

  it("fails closed on duplicate ids across cursor pages", () => {
    const loading = {
      ...initialWalletOperationState,
      scopeKey: "scope",
      filterKey,
      activeRequestKey: "request-2",
      items: [operation("operation-1")],
      nextCursor: "cursor-1",
      cursorTrail: ["cursor-1"],
      loadingMore: true,
    };
    const rejected = walletOperationReducer(loading, {
      type: "page",
      requestKey: "request-2",
      requestCursor: "cursor-1",
      page: { items: [operation("operation-1")], nextCursor: "cursor-2" },
      append: true,
    });
    expect(rejected.items.map((item) => item.id)).toEqual(["operation-1"]);
    expect(rejected.nextCursor).toBeNull();
    expect(rejected.error).toBe("Backend returned inconsistent Wallet operation pagination");
  });

  it("rejects historical A to B to A cursor rollback", () => {
    const state = {
      ...initialWalletOperationState,
      scopeKey: "scope",
      filterKey,
      activeRequestKey: "request-b",
      items: [operation("operation-2")],
      nextCursor: "cursor-b",
      cursorTrail: ["cursor-a", "cursor-b"],
      loadingMore: true,
    };
    const rejected = walletOperationReducer(state, {
      type: "page",
      requestKey: "request-b",
      requestCursor: "cursor-b",
      page: { items: [operation("operation-1")], nextCursor: "cursor-a" },
      append: true,
    });
    expect(rejected.error).toBe("Backend returned inconsistent Wallet operation pagination");
    expect(rejected.nextCursor).toBeNull();
  });

  it("never exposes raw error details", () => {
    expect(walletOperationErrorMessage(new Error("tenant t-1 provider journal secret"))).toBe(
      "Wallet activity is unavailable",
    );
  });
});
