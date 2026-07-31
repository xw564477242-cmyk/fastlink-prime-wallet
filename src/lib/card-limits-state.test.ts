import { describe, expect, it } from "bun:test";
import type { WalletCardLimits } from "./backend-api";
import {
  cardLimitsErrorMessage,
  cardLimitsReducer,
  cardLimitsRequestKey,
  cardLimitsViewForScope,
  initialCardLimitsState,
} from "./card-limits-state";

const limits: WalletCardLimits = {
  cardId: "card-owned",
  singleTransactionMinor: "10000",
  dailySpendMinor: "50000",
  monthlySpendMinor: "500000",
  dailyAtmMinor: null,
  updatedAt: "2026-07-31T08:00:00Z",
};

describe("Selected Card limits state", () => {
  it("synchronously clears limits when actor, tenant, customer, environment or Card changes", () => {
    const previous = {
      ...initialCardLimitsState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","card-a"]',
      activeRequestKey: "request-old",
      limits,
      error: "foreign error",
    };
    expect(
      cardLimitsViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT","card-b"]'),
    ).toEqual({
      ...initialCardLimitsState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","card-b"]',
      loading: true,
      scopeReady: false,
    });
  });

  it("binds the complete Card scope and generation into the request key", () => {
    const first = cardLimitsRequestKey('["actor","tenant","customer","SANDBOX","card-a"]', 1);
    expect(first).not.toBe(
      cardLimitsRequestKey('["actor","tenant","customer","SANDBOX","card-b"]', 1),
    );
    expect(first).not.toBe(
      cardLimitsRequestKey('["actor","tenant","customer","SANDBOX","card-a"]', 2),
    );
  });

  it("rejects stale success, error and finally actions", () => {
    const current = cardLimitsReducer(initialCardLimitsState, {
      type: "reset",
      scopeKey: "scope-current",
      requestKey: "request-current",
      loading: true,
    });
    expect(
      cardLimitsReducer(current, { type: "loaded", requestKey: "request-stale", limits }),
    ).toBe(current);
    expect(
      cardLimitsReducer(current, {
        type: "failed",
        requestKey: "request-stale",
        message: "foreign error",
      }),
    ).toBe(current);
    expect(cardLimitsReducer(current, { type: "settled", requestKey: "request-stale" })).toBe(
      current,
    );
  });

  it("accepts and settles only the exact active request", () => {
    const loading = {
      ...initialCardLimitsState,
      scopeKey: "scope-current",
      activeRequestKey: "request-current",
      loading: true,
    };
    const loaded = cardLimitsReducer(loading, {
      type: "loaded",
      requestKey: "request-current",
      limits,
    });
    expect(loaded.limits).toEqual(limits);
    expect(loaded.loading).toBeTrue();
    expect(
      cardLimitsReducer(loaded, { type: "settled", requestKey: "request-current" }).loading,
    ).toBeFalse();
  });

  it("never exposes Provider or scope details in errors", () => {
    expect(cardLimitsErrorMessage(new Error("THREDD token tenant journal timeout"))).toBe(
      "Card limits are unavailable",
    );
    expect(cardLimitsErrorMessage(new Error("customer production unavailable"))).toBe(
      "Card limits are unavailable",
    );
  });
});
