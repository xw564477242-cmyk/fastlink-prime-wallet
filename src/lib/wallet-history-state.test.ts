import { describe, expect, it } from "bun:test";
import type { WalletAccountTransaction, WalletAssetAccount } from "./backend-api";
import {
  captureWalletBalanceAccountsVersion,
  initialWalletAccountState,
  walletAccountReducer,
  walletAccountViewForSession,
} from "./wallet-account-state";
import {
  initialWalletTransactionState,
  walletTransactionReducer,
  walletTransactionRequestKey,
  walletTransactionViewForScope,
} from "./wallet-transaction-state";

const account = (assetCode: string): WalletAssetAccount => ({
  assetCode,
  availableBalance: "10",
  ledgerBalance: "12.5",
  pendingBalance: "2.5",
  updatedAt: "2026-07-31T12:00:00.000Z",
});

const transaction = (id: string, assetCode = "USD"): WalletAccountTransaction => ({
  id,
  type: "transfer",
  status: "completed",
  assetCode,
  amount: "25.5",
  direction: "outgoing",
  createdAt: "2026-07-31T12:00:00.000Z",
  updatedAt: "2026-07-31T12:00:01.000Z",
});

describe("Wallet account state", () => {
  it("synchronously hides prior-session balances before effects commit", () => {
    const previous = {
      ...initialWalletAccountState,
      sessionKey: "session-a",
      requestId: 7,
      accounts: [account("USD")],
      selectedAssetCode: "USD",
    };
    expect(walletAccountViewForSession(previous, "session-b")).toEqual({
      ...initialWalletAccountState,
      sessionKey: "session-b",
      requestId: 7,
      loading: true,
      scopeReady: false,
    });
  });

  it("rejects stale balance responses and foreign account selections", () => {
    const currentIdentity = {
      sessionKey: "session-b",
      requestId: 2,
      accountsVersion: captureWalletBalanceAccountsVersion([]),
    };
    const current = walletAccountReducer(initialWalletAccountState, {
      type: "reset",
      identity: currentIdentity,
      loading: true,
    });
    expect(
      walletAccountReducer(current, {
        type: "loaded",
        identity: { ...currentIdentity, requestId: 1 },
        accounts: [account("EUR")],
        accountsVersion: captureWalletBalanceAccountsVersion([account("EUR")]),
      }),
    ).toBe(current);
    const loaded = walletAccountReducer(current, {
      type: "loaded",
      identity: currentIdentity,
      accounts: [account("USD")],
      accountsVersion: captureWalletBalanceAccountsVersion([account("USD")]),
    });
    expect(
      walletAccountReducer(loaded, {
        type: "select",
        sessionKey: "session-a",
        assetCode: "USD",
      }),
    ).toBe(loaded);
  });

  it("rejects stale success, error and finally writes across scope, version and generation", () => {
    const identity = {
      sessionKey: "actor-session-tenant-customer-test",
      requestId: 9,
      accountsVersion: captureWalletBalanceAccountsVersion([account("USD")]),
    };
    const current = walletAccountReducer(initialWalletAccountState, {
      type: "reset",
      identity,
      loading: true,
    });
    const staleIdentities = [
      { ...identity, requestId: 8 },
      { ...identity, sessionKey: "other-session" },
      { ...identity, accountsVersion: captureWalletBalanceAccountsVersion([account("EUR")]) },
    ];
    for (const staleIdentity of staleIdentities) {
      expect(
        walletAccountReducer(current, {
          type: "loaded",
          identity: staleIdentity,
          accounts: [account("EUR")],
          accountsVersion: captureWalletBalanceAccountsVersion([account("EUR")]),
        }),
      ).toBe(current);
      expect(
        walletAccountReducer(current, {
          type: "failed",
          identity: staleIdentity,
          message: "stale failure",
        }),
      ).toBe(current);
      expect(walletAccountReducer(current, { type: "settled", identity: staleIdentity })).toBe(
        current,
      );
    }
  });
});

describe("Wallet transaction state", () => {
  it("synchronously hides history when actor, tenant, customer, environment or account changes", () => {
    const previous = {
      ...initialWalletTransactionState,
      scopeKey: '["actor-a","tenant-a","customer-a","SANDBOX","USD"]',
      activeRequestKey: "old-request",
      items: [transaction("foreign")],
      nextCursor: "foreign-cursor",
      loadingMore: true,
    };
    expect(
      walletTransactionViewForScope(previous, '["actor-b","tenant-b","customer-b","UAT","EUR"]'),
    ).toEqual({
      ...initialWalletTransactionState,
      scopeKey: '["actor-b","tenant-b","customer-b","UAT","EUR"]',
      loading: true,
      scopeReady: false,
    });
  });

  it("deterministically rejects stale success and failure responses", () => {
    const currentRequest = walletTransactionRequestKey("scope-eur", null, 2);
    const current = walletTransactionReducer(initialWalletTransactionState, {
      type: "reset",
      scopeKey: "scope-eur",
      requestKey: currentRequest,
      loading: true,
    });
    expect(
      walletTransactionReducer(current, {
        type: "page",
        requestKey: walletTransactionRequestKey("scope-eur", null, 1),
        requestCursor: null,
        page: { items: [transaction("foreign")], nextCursor: "foreign-cursor" },
        append: false,
      }),
    ).toBe(current);
    expect(
      walletTransactionReducer(current, {
        type: "settled",
        requestKey: walletTransactionRequestKey("scope-eur", null, 1),
      }),
    ).toBe(current);
    expect(
      walletTransactionReducer(current, {
        type: "failed",
        requestKey: walletTransactionRequestKey("scope-eur", null, 1),
        message: "foreign failure",
        append: false,
      }),
    ).toBe(current);
  });

  it("appends explicit cursor pages without duplicates and preserves safe rows on failure", () => {
    const loaded = {
      ...initialWalletTransactionState,
      scopeKey: "scope-usd",
      activeRequestKey: walletTransactionRequestKey("scope-usd", null, 2),
      items: [transaction("tx-2"), transaction("tx-1")],
      nextCursor: "cursor-2",
      seenCursors: ["cursor-2"],
    };
    const pageRequest = walletTransactionRequestKey("scope-usd", "cursor-2", 3);
    const loadingMore = walletTransactionReducer(loaded, {
      type: "loading-more",
      requestKey: pageRequest,
      requestCursor: "cursor-2",
    });
    const next = walletTransactionReducer(loadingMore, {
      type: "page",
      requestKey: pageRequest,
      requestCursor: "cursor-2",
      page: { items: [transaction("tx-0")], nextCursor: "cursor-0" },
      append: true,
    });
    expect(next.items.map((item) => item.id)).toEqual(["tx-2", "tx-1", "tx-0"]);
    const failed = walletTransactionReducer(
      {
        ...next,
        activeRequestKey: walletTransactionRequestKey("scope-usd", "cursor-0", 4),
        loadingMore: true,
      },
      {
        type: "failed",
        requestKey: walletTransactionRequestKey("scope-usd", "cursor-0", 4),
        message: "temporary",
        append: true,
      },
    );
    expect(failed.items.map((item) => item.id)).toEqual(["tx-2", "tx-1", "tx-0"]);
    expect(failed.nextCursor).toBe("cursor-0");
  });
});
