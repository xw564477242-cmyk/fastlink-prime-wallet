import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  backendRuntime,
  type BackendSession,
  type WalletAccountTransaction,
  type WalletTransactionStatusFilter,
  type WalletTransactionTypeFilter,
} from "@/lib/backend-api";
import {
  useWalletAccountHistory,
  type WalletTransactionFilters,
} from "./use-wallet-account-history";
import { useWalletTransactionDetail } from "./use-wallet-transaction-detail";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HistoryResult = ReturnType<typeof useWalletAccountHistory>;
type DetailResult = ReturnType<typeof useWalletTransactionDetail>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let historyResult: HistoryResult | null = null;
let detailResult: DetailResult | null = null;
const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Wallet history mounted test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-wallet-history-01",
    tenantId: "tenant-wallet-history-01",
    customerId: "customer-wallet-history-01",
    environment: environment(),
    expiresAt: "2099-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function wireTransaction(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    type: "TRANSFER",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25.5",
    direction: "OUTGOING",
    createdAt: "2026-07-31T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:01.000Z",
    ...patch,
  };
}

function transaction(id: string): WalletAccountTransaction {
  return {
    id,
    type: "transfer",
    status: "completed",
    assetCode: "USD",
    amount: "25.5",
    direction: "outgoing",
    createdAt: "2026-07-31T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:01.000Z",
  };
}

function balanceResponse(
  items: unknown[] = [
    {
      assetCode: "USD",
      availableBalance: "10",
      ledgerBalance: "12.5",
      pendingBalance: "2.5",
      updatedAt: "2026-07-31T12:00:00.000Z",
    },
  ],
): Response {
  return new Response(
    JSON.stringify({
      items,
    }),
    { status: 200, headers: { "x-trace-id": "trace-wallet-balance" } },
  );
}

function pageResponse(items: unknown[], nextCursor: string | null): Response {
  return new Response(JSON.stringify({ items, nextCursor }), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "trace-wallet-history" },
  });
}

function detailResponse(item: unknown): Response {
  return new Response(JSON.stringify(item), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "trace-wallet-detail" },
  });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function installFetch(
  responder: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return responder(input, init);
  }) as typeof globalThis.fetch;
  return calls;
}

function HistoryHarness({
  currentSession,
  type,
  status,
}: {
  currentSession: BackendSession | null;
  type?: WalletTransactionTypeFilter;
  status?: WalletTransactionStatusFilter;
}) {
  const filters: WalletTransactionFilters = { type, status };
  historyResult = useWalletAccountHistory(currentSession, filters);
  return null;
}

function DetailHarness({
  currentSession,
  selected,
}: {
  currentSession: BackendSession | null;
  selected: WalletAccountTransaction | null;
}) {
  detailResult = useWalletTransactionDetail(
    currentSession,
    selected?.assetCode ?? null,
    selected,
    currentSession && selected ? "wallet-history-mounted-scope" : null,
  );
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function unmount() {
  if (!renderer) return;
  await act(async () => {
    renderer?.unmount();
    await flush();
  });
  renderer = null;
  historyResult = null;
  detailResult = null;
}

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Wallet transaction filter mounted safety (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("binds exact filters to the request and aborts stale initial work before accepting its result", async () => {
      const oldRead = deferred<Response>();
      const currentSession = session();
      const calls = installFetch((input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        if (url.pathname.endsWith("/v1/wallet/balances")) return balanceResponse();
        if (url.searchParams.get("type") === "TRANSFER") return pageResponse([], null);
        return oldRead.promise;
      });

      await act(async () => {
        renderer = create(createElement(HistoryHarness, { currentSession }));
        await flush();
      });
      await act(async () => {
        renderer?.update(
          createElement(HistoryHarness, {
            currentSession,
            type: "TRANSFER",
            status: "COMPLETED",
          }),
        );
        await flush();
      });

      const transactionCalls = calls.filter(({ input }) =>
        String(input).includes("/v1/wallet/transactions?"),
      );
      expect(transactionCalls).toHaveLength(2);
      expect(transactionCalls[0]?.init?.signal?.aborted).toBe(true);
      const filteredUrl = new URL(String(transactionCalls[1]?.input), "https://wallet.invalid");
      expect(Object.fromEntries(filteredUrl.searchParams)).toEqual({
        assetCode: "USD",
        limit: "25",
        type: "TRANSFER",
        status: "COMPLETED",
      });
      expect(historyResult?.transactions.items).toEqual([]);

      await act(async () => {
        oldRead.resolve(pageResponse([wireTransaction("wallet-stale-secret")], "c3RhbGU.c2ln"));
        await flush();
      });
      expect(JSON.stringify(historyResult)).not.toContain("wallet-stale-secret");
    });

    it("aborts an account-bound pagination request when filters change and rejects late writes", async () => {
      const oldPage = deferred<Response>();
      const currentSession = session();
      let transactionReads = 0;
      const calls = installFetch((input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        if (url.pathname.endsWith("/v1/wallet/balances")) return balanceResponse();
        transactionReads += 1;
        if (transactionReads === 1) {
          return pageResponse([wireTransaction("wallet-current")], "cGFnZQ.c2ln");
        }
        if (transactionReads === 2) return oldPage.promise;
        return pageResponse([], null);
      });

      await act(async () => {
        renderer = create(createElement(HistoryHarness, { currentSession }));
        await flush();
      });
      await act(async () => {
        void historyResult?.loadMore();
        await flush();
      });
      await act(async () => {
        renderer?.update(createElement(HistoryHarness, { currentSession, status: "PENDING" }));
        await flush();
      });

      const transactionCalls = calls.filter(({ input }) =>
        String(input).includes("/v1/wallet/transactions?"),
      );
      expect(transactionCalls[1]?.init?.signal?.aborted).toBe(true);
      expect(historyResult?.transactions.items).toEqual([]);
      await act(async () => {
        oldPage.resolve(pageResponse([wireTransaction("wallet-late-page")], null));
        await flush();
      });
      expect(JSON.stringify(historyResult)).not.toContain("wallet-late-page");
    });

    it("refreshes the selected account with exact filters and preserves the visible page on failure", async () => {
      const failedRefresh = deferred<Response>();
      const currentSession = session();
      let transactionReads = 0;
      const calls = installFetch((input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        if (url.pathname.endsWith("/v1/wallet/balances")) return balanceResponse();
        transactionReads += 1;
        if (transactionReads === 1) {
          return pageResponse(
            [wireTransaction("wallet-current", { type: "DEPOSIT", status: "PENDING" })],
            "cGFnZQ.c2ln",
          );
        }
        if (transactionReads === 2) {
          return pageResponse(
            [wireTransaction("wallet-current-page-2", { type: "DEPOSIT", status: "PENDING" })],
            "cGFnZTI.c2ln",
          );
        }
        if (transactionReads === 3) return failedRefresh.promise;
        return pageResponse(
          [wireTransaction("wallet-refreshed", { type: "DEPOSIT", status: "PENDING" })],
          "cmVmcmVzaGVk.c2ln",
        );
      });

      await act(async () => {
        renderer = create(
          createElement(HistoryHarness, {
            currentSession,
            type: "DEPOSIT",
            status: "PENDING",
          }),
        );
        await flush();
      });
      await act(async () => {
        await historyResult?.loadMore();
        await flush();
      });
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual([
        "wallet-current",
        "wallet-current-page-2",
      ]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTI.c2ln");

      await act(async () => {
        historyResult?.refresh();
        await flush();
      });
      const refreshCall = calls.filter(({ input }) =>
        String(input).includes("/v1/wallet/transactions?"),
      )[2];
      const refreshUrl = new URL(String(refreshCall?.input), "https://wallet.invalid");
      expect(Object.fromEntries(refreshUrl.searchParams)).toEqual({
        assetCode: "USD",
        limit: "25",
        type: "DEPOSIT",
        status: "PENDING",
      });
      expect(historyResult?.accounts.selectedAssetCode).toBe("USD");
      expect(historyResult?.transactions.refreshing).toBe(true);
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual([
        "wallet-current",
        "wallet-current-page-2",
      ]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTI.c2ln");

      await act(async () => {
        failedRefresh.resolve(new Response("unavailable", { status: 503 }));
        await flush();
      });
      expect(historyResult?.transactions.refreshing).toBe(false);
      expect(historyResult?.transactions.refreshError).toBe(
        "Wallet transaction history refresh failed",
      );
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual([
        "wallet-current",
        "wallet-current-page-2",
      ]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTI.c2ln");

      await act(async () => {
        historyResult?.refresh();
        await flush();
      });
      expect(historyResult?.transactions.refreshError).toBeNull();
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual([
        "wallet-refreshed",
      ]);
      expect(historyResult?.transactions.nextCursor).toBe("cmVmcmVzaGVk.c2ln");
      expect(historyResult?.accounts.selectedAssetCode).toBe("USD");
    });

    it("aborts refresh and rejects stale success after account or tenant changes", async () => {
      const staleRefreshes = [
        {
          label: "account",
          change: () => historyResult?.selectAccount("ZAR"),
        },
        {
          label: "tenant",
          session: session({ tenantId: "tenant-wallet-history-02" }),
        },
      ];

      for (const change of staleRefreshes) {
        const pendingRefresh = deferred<Response>();
        let transactionReads = 0;
        const calls = installFetch((input) => {
          const url = new URL(String(input), "https://wallet.invalid");
          if (url.pathname.endsWith("/v1/wallet/balances")) {
            return balanceResponse([
              {
                assetCode: "USD",
                availableBalance: "10",
                ledgerBalance: "12.5",
                pendingBalance: "2.5",
                updatedAt: "2026-07-31T12:00:00.000Z",
              },
              {
                assetCode: "ZAR",
                availableBalance: "20",
                ledgerBalance: "20",
                pendingBalance: "0",
                updatedAt: "2026-07-31T12:00:00.000Z",
              },
            ]);
          }
          transactionReads += 1;
          if (transactionReads === 1) {
            return pageResponse([wireTransaction(`wallet-${change.label}-current`)], null);
          }
          if (transactionReads === 2) return pendingRefresh.promise;
          const assetCode = url.searchParams.get("assetCode") ?? "USD";
          return pageResponse(
            [wireTransaction(`wallet-${change.label}-new-scope`, { assetCode })],
            null,
          );
        });

        const originalSession = session();
        await act(async () => {
          renderer = create(createElement(HistoryHarness, { currentSession: originalSession }));
          await flush();
        });
        await act(async () => {
          await flush();
        });
        expect(historyResult?.canRefresh, change.label).toBe(true);
        await act(async () => {
          historyResult?.refresh();
          await flush();
        });
        await act(async () => {
          if (change.change) {
            change.change();
          } else {
            renderer?.update(
              createElement(HistoryHarness, { currentSession: change.session ?? originalSession }),
            );
          }
          await flush();
        });

        const refreshCall = calls.filter(({ input }) =>
          String(input).includes("/v1/wallet/transactions?"),
        )[1];
        expect(refreshCall?.init?.signal?.aborted, change.label).toBe(true);
        await act(async () => {
          pendingRefresh.resolve(
            pageResponse([wireTransaction(`wallet-${change.label}-stale`)], null),
          );
          await flush();
        });
        expect(JSON.stringify(historyResult), change.label).not.toContain(
          `wallet-${change.label}-stale`,
        );
        expect(JSON.stringify(historyResult), change.label).toContain(
          `wallet-${change.label}-new-scope`,
        );
        await unmount();
      }
    });

    it("serializes cursor pagination and recovers without changing safe rows or cursor", async () => {
      const failedPage = deferred<Response>();
      const currentSession = session();
      let transactionReads = 0;
      const calls = installFetch((input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        if (url.pathname.endsWith("/v1/wallet/balances")) return balanceResponse();
        transactionReads += 1;
        if (transactionReads === 1) {
          return pageResponse([wireTransaction("wallet-page-1")], "cGFnZTE.c2ln");
        }
        if (transactionReads === 2) return failedPage.promise;
        if (transactionReads === 3) {
          return pageResponse([wireTransaction("wallet-page-1")], "ZHVwbGljYXRl.c2ln");
        }
        if (transactionReads === 4) {
          return pageResponse([wireTransaction("wallet-rejected-long-cursor")], "x".repeat(513));
        }
        return pageResponse([wireTransaction("wallet-page-2")], "cGFnZTI.c2ln");
      });

      await act(async () => {
        renderer = create(
          createElement(HistoryHarness, {
            currentSession,
            type: "TRANSFER",
            status: "COMPLETED",
          }),
        );
        await flush();
      });

      let firstLoad: Promise<void> | undefined;
      let duplicateLoad: Promise<void> | undefined;
      await act(async () => {
        firstLoad = historyResult?.loadMore();
        duplicateLoad = historyResult?.loadMore();
        await flush();
      });
      const firstPaginationCalls = calls.filter(({ input }) =>
        String(input).includes("/v1/wallet/transactions?"),
      );
      expect(firstPaginationCalls).toHaveLength(2);
      const pageUrl = new URL(String(firstPaginationCalls[1]?.input), "https://wallet.invalid");
      expect(Object.fromEntries(pageUrl.searchParams)).toEqual({
        assetCode: "USD",
        limit: "25",
        type: "TRANSFER",
        status: "COMPLETED",
        cursor: "cGFnZTE.c2ln",
      });
      expect(pageUrl.searchParams.has("offset")).toBe(false);

      await act(async () => {
        failedPage.resolve(new Response("unavailable", { status: 503 }));
        await firstLoad;
        await duplicateLoad;
        await flush();
      });
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual(["wallet-page-1"]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTE.c2ln");

      await act(async () => {
        await historyResult?.loadMore();
        await flush();
      });
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual(["wallet-page-1"]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTE.c2ln");
      expect(historyResult?.transactions.error).toBe(
        "Backend returned inconsistent Wallet transaction pagination",
      );

      await act(async () => {
        await historyResult?.loadMore();
        await flush();
      });
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual(["wallet-page-1"]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTE.c2ln");
      expect(JSON.stringify(historyResult)).not.toContain("wallet-rejected-long-cursor");

      await act(async () => {
        await historyResult?.loadMore();
        await flush();
      });
      expect(historyResult?.transactions.items.map((item) => item.id)).toEqual([
        "wallet-page-1",
        "wallet-page-2",
      ]);
      expect(historyResult?.transactions.nextCursor).toBe("cGFnZTI.c2ln");
      expect(historyResult?.transactions.error).toBeNull();
      expect(transactionReads).toBe(5);
    });

    it("aborts cursor pagination on logout and unmount and rejects both late pages", async () => {
      const logoutPage = deferred<Response>();
      const unmountPage = deferred<Response>();
      let transactionReads = 0;
      const calls = installFetch((input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        if (url.pathname.endsWith("/v1/wallet/balances")) return balanceResponse();
        transactionReads += 1;
        if (transactionReads === 1) {
          return pageResponse([wireTransaction("wallet-before-logout")], "bG9nb3V0.c2ln");
        }
        if (transactionReads === 2) return logoutPage.promise;
        if (transactionReads === 3) {
          return pageResponse([wireTransaction("wallet-before-unmount")], "dW5tb3VudA.c2ln");
        }
        return unmountPage.promise;
      });

      const firstSession = session();
      await act(async () => {
        renderer = create(createElement(HistoryHarness, { currentSession: firstSession }));
        await flush();
      });
      let logoutLoad: Promise<void> | undefined;
      await act(async () => {
        logoutLoad = historyResult?.loadMore();
        await flush();
      });
      await act(async () => {
        renderer?.update(createElement(HistoryHarness, { currentSession: null }));
        await flush();
      });
      const transactionCalls = () =>
        calls.filter(({ input }) => String(input).includes("/v1/wallet/transactions?"));
      expect(transactionCalls()[1]?.init?.signal?.aborted).toBe(true);
      await act(async () => {
        logoutPage.resolve(pageResponse([wireTransaction("wallet-late-after-logout")], null));
        await logoutLoad;
        await flush();
      });
      expect(JSON.stringify(historyResult)).not.toContain("wallet-late-after-logout");

      const nextSession = session({ actorId: "actor-wallet-history-02" });
      await act(async () => {
        renderer?.update(createElement(HistoryHarness, { currentSession: nextSession }));
        await flush();
      });
      let unmountLoad: Promise<void> | undefined;
      await act(async () => {
        unmountLoad = historyResult?.loadMore();
        await flush();
      });
      expect(transactionCalls()).toHaveLength(4);
      await unmount();
      expect(transactionCalls()[3]?.init?.signal?.aborted).toBe(true);
      unmountPage.resolve(pageResponse([wireTransaction("wallet-late-after-unmount")], null));
      await unmountLoad;
    });

    it("actively aborts selected transaction detail on selection change and unmount", async () => {
      const oldDetail = deferred<Response>();
      const currentDetail = deferred<Response>();
      const currentSession = session();
      const calls = installFetch((input) =>
        String(input).endsWith("wallet-txn-1") ? oldDetail.promise : currentDetail.promise,
      );

      await act(async () => {
        renderer = create(
          createElement(DetailHarness, { currentSession, selected: transaction("wallet-txn-1") }),
        );
        await flush();
      });
      await act(async () => {
        renderer?.update(
          createElement(DetailHarness, { currentSession, selected: transaction("wallet-txn-2") }),
        );
        await flush();
      });
      expect(calls[0]?.init?.signal?.aborted).toBe(true);

      await unmount();
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      oldDetail.resolve(detailResponse(wireTransaction("wallet-txn-1")));
      currentDetail.resolve(detailResponse(wireTransaction("wallet-txn-2")));
    });
  },
);
