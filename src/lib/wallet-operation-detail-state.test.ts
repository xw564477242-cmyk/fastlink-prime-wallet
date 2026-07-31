import { describe, expect, it } from "bun:test";
import type { WalletOperationActivity } from "./backend-api";
import {
  initialWalletOperationDetailState,
  walletOperationDetailErrorMessage,
  walletOperationDetailReducer,
  walletOperationDetailRequestKey,
  walletOperationDetailViewForScope,
} from "./wallet-operation-detail-state";

const detail: WalletOperationActivity = {
  id: "operation-1",
  type: "internal_transfer",
  status: "completed",
  assetCode: "USD",
  amount: "25.5",
  direction: "between_own_accounts",
  createdAt: "2026-07-31T12:00:00Z",
  completedAt: "2026-07-31T12:00:01Z",
  updatedAt: "2026-07-31T12:00:01Z",
};

describe("Wallet operation detail state", () => {
  it("synchronously clears detail when identity, environment or operation changes", () => {
    const previous = {
      ...initialWalletOperationDetailState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","operation-a"]',
      activeRequestKey: "old-request",
      detail,
      error: "foreign error",
    };
    expect(
      walletOperationDetailViewForScope(
        previous,
        '["actor-b","tenant-b","customer-b","UAT","operation-b"]',
      ),
    ).toEqual({
      ...initialWalletOperationDetailState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","operation-b"]',
      loading: true,
      scopeReady: false,
    });
  });

  it("binds the complete selection scope and generation into the request key", () => {
    const first = walletOperationDetailRequestKey(
      '["actor","tenant","customer","SANDBOX","operation-1"]',
      1,
    );
    expect(first).not.toBe(
      walletOperationDetailRequestKey('["actor","tenant","customer","SANDBOX","operation-2"]', 1),
    );
    expect(first).not.toBe(
      walletOperationDetailRequestKey('["actor","tenant","customer","SANDBOX","operation-1"]', 2),
    );
  });

  it("rejects stale success, error and finally actions", () => {
    const current = walletOperationDetailReducer(initialWalletOperationDetailState, {
      type: "reset",
      scopeKey: "scope-current",
      requestKey: "request-current",
      loading: true,
    });
    expect(
      walletOperationDetailReducer(current, {
        type: "loaded",
        requestKey: "request-stale",
        detail,
      }),
    ).toBe(current);
    expect(
      walletOperationDetailReducer(current, {
        type: "failed",
        requestKey: "request-stale",
        message: "foreign error",
      }),
    ).toBe(current);
    expect(
      walletOperationDetailReducer(current, {
        type: "settled",
        requestKey: "request-stale",
      }),
    ).toBe(current);
  });

  it("accepts and settles only the exact active request", () => {
    const loading = {
      ...initialWalletOperationDetailState,
      scopeKey: "scope-current",
      activeRequestKey: "request-current",
      loading: true,
    };
    const loaded = walletOperationDetailReducer(loading, {
      type: "loaded",
      requestKey: "request-current",
      detail,
    });
    expect(loaded.detail).toEqual(detail);
    expect(loaded.loading).toBeTrue();
    expect(
      walletOperationDetailReducer(loaded, {
        type: "settled",
        requestKey: "request-current",
      }).loading,
    ).toBeFalse();
  });

  it("uses one safe message for unknown, out-of-scope and transport failures", () => {
    expect(walletOperationDetailErrorMessage(new Error("HTTP 404 tenant provider journal"))).toBe(
      "Wallet operation detail is unavailable",
    );
    expect(walletOperationDetailErrorMessage(new Error("HTTP 403 treasury internal"))).toBe(
      "Wallet operation detail is unavailable",
    );
  });
});
