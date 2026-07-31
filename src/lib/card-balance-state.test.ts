import { describe, expect, it } from "bun:test";
import type { WalletCardBalance } from "./backend-api";
import {
  cardBalanceErrorMessage,
  cardBalanceReducer,
  cardBalanceRequestKey,
  cardBalanceViewForScope,
  initialCardBalanceState,
} from "./card-balance-state";

const balance: WalletCardBalance = {
  cardId: "card-owned",
  currency: "USD",
  availableBalanceMinor: "12345",
  currentBalanceMinor: "13000",
  pendingAmountMinor: "655",
  updatedAt: "2026-07-31T08:00:00Z",
};

describe("Selected Card balance state", () => {
  it("synchronously clears balance when actor, tenant, customer, environment or Card changes", () => {
    const previous = {
      ...initialCardBalanceState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","card-a"]',
      activeRequestKey: "request-old",
      balance,
      error: "foreign error",
    };
    expect(
      cardBalanceViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT","card-b"]'),
    ).toEqual({
      ...initialCardBalanceState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","card-b"]',
      loading: true,
      scopeReady: false,
    });
  });

  it("binds the complete Card scope and generation into the request key", () => {
    const first = cardBalanceRequestKey('["actor","tenant","customer","SANDBOX","card-a"]', 1);
    expect(first).not.toBe(
      cardBalanceRequestKey('["actor","tenant","customer","SANDBOX","card-b"]', 1),
    );
    expect(first).not.toBe(
      cardBalanceRequestKey('["actor","tenant","customer","SANDBOX","card-a"]', 2),
    );
  });

  it("rejects stale success, error and finally actions", () => {
    const current = cardBalanceReducer(initialCardBalanceState, {
      type: "reset",
      scopeKey: "scope-current",
      requestKey: "request-current",
      loading: true,
    });
    expect(
      cardBalanceReducer(current, {
        type: "loaded",
        requestKey: "request-stale",
        balance,
      }),
    ).toBe(current);
    expect(
      cardBalanceReducer(current, {
        type: "failed",
        requestKey: "request-stale",
        message: "foreign error",
      }),
    ).toBe(current);
    expect(cardBalanceReducer(current, { type: "settled", requestKey: "request-stale" })).toBe(
      current,
    );
  });

  it("accepts and settles only the exact active request", () => {
    const loading = {
      ...initialCardBalanceState,
      scopeKey: "scope-current",
      activeRequestKey: "request-current",
      loading: true,
    };
    const loaded = cardBalanceReducer(loading, {
      type: "loaded",
      requestKey: "request-current",
      balance,
    });
    expect(loaded.balance).toEqual(balance);
    expect(loaded.loading).toBeTrue();
    expect(
      cardBalanceReducer(loaded, { type: "settled", requestKey: "request-current" }).loading,
    ).toBeFalse();
  });

  it("never exposes Provider or scope details in errors", () => {
    expect(cardBalanceErrorMessage(new Error("THREDD token tenant journal timeout"))).toBe(
      "Card balance is unavailable",
    );
    expect(cardBalanceErrorMessage(new Error("customer production unavailable"))).toBe(
      "Card balance is unavailable",
    );
  });
});
