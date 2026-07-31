import { describe, expect, it } from "bun:test";
import type { WalletAccountTransaction } from "./backend-api";
import {
  initialWalletTransactionDetailState,
  walletTransactionDetailErrorMessage,
  walletTransactionDetailReducer,
  walletTransactionDetailViewForScope,
} from "./wallet-transaction-detail-state";

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

describe("Wallet transaction detail state", () => {
  it("synchronously hides old detail when identity, account or transaction changes", () => {
    const previous = {
      ...initialWalletTransactionDetailState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","USD","txn-a"]',
      requestId: 7,
      detail,
      error: "foreign error",
    };
    expect(
      walletTransactionDetailViewForScope(
        previous,
        '["actor-b","tenant-b","customer-b","UAT","EUR","txn-b"]',
      ),
    ).toEqual({
      ...initialWalletTransactionDetailState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","EUR","txn-b"]',
      requestId: 7,
      loading: true,
      scopeReady: false,
    });
  });

  it("rejects stale success, error and finally actions after generation changes", () => {
    const current = walletTransactionDetailReducer(initialWalletTransactionDetailState, {
      type: "reset",
      scopeKey: "scope-new",
      requestId: 2,
      loading: true,
    });
    expect(walletTransactionDetailReducer(current, { type: "loaded", requestId: 1, detail })).toBe(
      current,
    );
    expect(
      walletTransactionDetailReducer(current, {
        type: "failed",
        requestId: 1,
        message: "foreign error",
      }),
    ).toBe(current);
    expect(walletTransactionDetailReducer(current, { type: "settled", requestId: 1 })).toBe(
      current,
    );
  });

  it("accepts only the current generation and settles loading independently", () => {
    const loading = {
      ...initialWalletTransactionDetailState,
      scopeKey: "scope-current",
      requestId: 3,
      loading: true,
    };
    const loaded = walletTransactionDetailReducer(loading, {
      type: "loaded",
      requestId: 3,
      detail,
    });
    expect(loaded.detail).toEqual(detail);
    expect(loaded.loading).toBeTrue();
    expect(
      walletTransactionDetailReducer(loaded, { type: "settled", requestId: 3 }).loading,
    ).toBeFalse();
  });

  it("uses one safe message for 404, out-of-scope and network failures", () => {
    expect(walletTransactionDetailErrorMessage(new Error("HTTP 404 account internal"))).toBe(
      "Wallet transaction detail is unavailable",
    );
    expect(walletTransactionDetailErrorMessage(new Error("HTTP 403 provider detail"))).toBe(
      "Wallet transaction detail is unavailable",
    );
    expect(walletTransactionDetailErrorMessage(null)).toBe(
      "Wallet transaction detail is unavailable",
    );
  });
});
