import { describe, expect, it } from "bun:test";
import type { WalletCard } from "./backend-api";
import { cardListReducer, cardListViewForSession, initialCardListState } from "./card-list-state";

const card = (cardId: string): WalletCard => ({
  cardId,
  type: "virtual",
  status: "active",
  last4: "4242",
  expiry: "12/30",
  currency: "USD",
  alias: cardId,
  balance: 10,
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: false,
    renew: false,
    updateLimits: false,
  },
});

describe("Card list state", () => {
  it("synchronously hides prior-scope state before the reset effect commits", () => {
    const previousScope = {
      ...initialCardListState,
      sessionKey: "session-a",
      requestId: 7,
      cards: [card("foreign-card")],
      nextCursor: "foreign-cursor",
      activeId: "foreign-card",
      loadingMore: true,
      error: "foreign-error",
    };

    expect(cardListViewForSession(previousScope, "session-b")).toEqual({
      ...initialCardListState,
      sessionKey: "session-b",
      requestId: 7,
      loading: true,
      scopeReady: false,
    });
  });

  it("keeps the current-scope state and marks it ready", () => {
    const currentScope = {
      ...initialCardListState,
      sessionKey: "session-a",
      cards: [card("card-a")],
      activeId: "card-a",
    };

    expect(cardListViewForSession(currentScope, "session-a")).toEqual({
      ...currentScope,
      scopeReady: true,
    });
  });

  it("ignores an old-scope card operation after the reducer has reset", () => {
    const currentScope = {
      ...initialCardListState,
      sessionKey: "session-b",
      cards: [card("card-b")],
      activeId: "card-b",
    };

    expect(
      cardListReducer(currentScope, {
        type: "prepend",
        sessionKey: "session-a",
        card: card("foreign-card"),
      }),
    ).toBe(currentScope);
    expect(
      cardListReducer(currentScope, {
        type: "invalidate",
        sessionKey: "session-a",
        requestId: 99,
        message: "foreign failure",
      }),
    ).toBe(currentScope);
  });

  it("clears cards and cursor immediately when the authenticated session changes", () => {
    const loaded = {
      ...initialCardListState,
      sessionKey: "session-a",
      requestId: 1,
      cards: [card("card-a")],
      nextCursor: "cursor-a",
      activeId: "card-a",
    };

    expect(
      cardListReducer(loaded, {
        type: "reset",
        requestId: 2,
        sessionKey: "session-b",
        preferredCardId: null,
        loading: true,
      }),
    ).toEqual({
      sessionKey: "session-b",
      requestId: 2,
      cards: [],
      nextCursor: null,
      activeId: null,
      loading: true,
      loadingMore: false,
      error: null,
    });
  });

  it("ignores a stale page after a session reset", () => {
    const reset = cardListReducer(initialCardListState, {
      type: "reset",
      requestId: 2,
      sessionKey: "session-b",
      preferredCardId: null,
      loading: true,
    });
    const stale = cardListReducer(reset, {
      type: "page",
      requestId: 1,
      page: { cards: [card("foreign-card")], nextCursor: "foreign-cursor" },
      append: false,
    });

    expect(stale).toBe(reset);
    expect(stale.cards).toEqual([]);
    expect(stale.nextCursor).toBeNull();
  });

  it("appends an explicit next page without duplicate cards", () => {
    const loaded = {
      ...initialCardListState,
      sessionKey: "session-a",
      requestId: 2,
      cards: [card("card-2"), card("card-1")],
      nextCursor: "cursor-2",
      activeId: "card-2",
    };
    const loadingMore = cardListReducer(loaded, { type: "loading-more", requestId: 3 });
    const next = cardListReducer(loadingMore, {
      type: "page",
      requestId: 3,
      page: { cards: [card("card-1"), card("card-0")], nextCursor: null },
      append: true,
    });

    expect(next.cards.map((item) => item.cardId)).toEqual(["card-2", "card-1", "card-0"]);
    expect(next.activeId).toBe("card-2");
    expect(next.nextCursor).toBeNull();
    expect(next.loadingMore).toBeFalse();
  });

  it("preserves validated current-scope cards when loading more fails", () => {
    const current = {
      ...initialCardListState,
      requestId: 4,
      cards: [card("card-1")],
      nextCursor: "retry-cursor",
      activeId: "card-1",
      loadingMore: true,
    };
    const failed = cardListReducer(current, {
      type: "failed",
      requestId: 4,
      message: "temporary failure",
      append: true,
    });

    expect(failed.cards.map((item) => item.cardId)).toEqual(["card-1"]);
    expect(failed.nextCursor).toBe("retry-cursor");
    expect(failed.error).toBe("temporary failure");
    expect(failed.loadingMore).toBeFalse();
  });

  it("represents an empty first page without retaining a preferred card", () => {
    const loading = cardListReducer(initialCardListState, {
      type: "reset",
      requestId: 5,
      sessionKey: "session-empty",
      preferredCardId: "missing-card",
      loading: true,
    });
    const empty = cardListReducer(loading, {
      type: "page",
      requestId: 5,
      page: { cards: [], nextCursor: null },
      append: false,
    });

    expect(empty.cards).toEqual([]);
    expect(empty.activeId).toBeNull();
    expect(empty.nextCursor).toBeNull();
    expect(empty.loading).toBeFalse();
    expect(empty.error).toBeNull();
  });
});
