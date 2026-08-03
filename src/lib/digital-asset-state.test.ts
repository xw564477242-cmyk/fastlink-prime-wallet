import { describe, expect, it } from "bun:test";
import {
  digitalAssetReducer,
  initialDigitalAssetState,
  type DigitalAssetState,
} from "./digital-asset-state";
import type { WalletTransferAccount } from "./backend-api";

function account(id: string, assetCode = "USDT"): WalletTransferAccount {
  return {
    id,
    assetCode,
    status: "active",
    currentBalance: "12",
    postedBalance: "10",
    pendingBalance: "2",
    availableBalance: "10",
    updatedAt: "2026-08-03T12:00:00.000Z",
  };
}

describe("Digital asset atomic snapshot state", () => {
  it("ignores stale completions and selects only an account in the accepted snapshot", () => {
    let state = digitalAssetReducer(initialDigitalAssetState, {
      type: "reset",
      scopeKey: "scope-current",
      requestKey: "request-current",
      preserveSnapshot: false,
    });
    state = digitalAssetReducer(state, {
      type: "loaded",
      requestKey: "request-stale",
      accounts: [account("account-stale")],
      snapshotVersion: "stale",
    });
    expect(state.accounts).toEqual([]);

    state = digitalAssetReducer(state, {
      type: "loaded",
      requestKey: "request-current",
      accounts: [account("account-current")],
      snapshotVersion: "current",
    });
    expect(state.selectedAccountId).toBe("account-current");
    expect(
      digitalAssetReducer(state, {
        type: "select",
        scopeKey: "scope-current",
        accountId: "account-unowned",
      }).selectedAccountId,
    ).toBe("account-current");
  });

  it("preserves a same-scope snapshot during refresh and keeps it on failure", () => {
    const accepted: DigitalAssetState = {
      ...initialDigitalAssetState,
      scopeKey: "scope",
      requestKey: "request-1",
      accounts: [account("account-usdt")],
      selectedAccountId: "account-usdt",
      snapshotVersion: "version-1",
    };
    let state = digitalAssetReducer(accepted, {
      type: "reset",
      scopeKey: "scope",
      requestKey: "request-2",
      preserveSnapshot: true,
    });
    expect(state.refreshing).toBe(true);
    expect(state.accounts).toEqual(accepted.accounts);
    state = digitalAssetReducer(state, {
      type: "failed",
      requestKey: "request-2",
      preserveSnapshot: true,
    });
    expect(state.accounts).toEqual(accepted.accounts);
    expect(state.refreshError).toBe("Digital asset refresh failed");
  });

  it("clears the entire snapshot when the Session scope changes", () => {
    const previous: DigitalAssetState = {
      ...initialDigitalAssetState,
      scopeKey: "scope-old",
      requestKey: "request-old",
      accounts: [account("account-old")],
      selectedAccountId: "account-old",
      snapshotVersion: "old",
    };
    const state = digitalAssetReducer(previous, {
      type: "reset",
      scopeKey: "scope-new",
      requestKey: "request-new",
      preserveSnapshot: true,
    });
    expect(state.accounts).toEqual([]);
    expect(state.selectedAccountId).toBeNull();
    expect(state.snapshotVersion).toBeNull();
    expect(state.loading).toBe(true);
  });
});
