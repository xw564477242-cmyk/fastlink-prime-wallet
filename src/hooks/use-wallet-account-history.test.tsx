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

function balanceResponse(): Response {
  return new Response(
    JSON.stringify({
      items: [
        {
          assetCode: "USD",
          availableBalance: "10",
          ledgerBalance: "12.5",
          pendingBalance: "2.5",
          updatedAt: "2026-07-31T12:00:00.000Z",
        },
      ],
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
  detailResult = useWalletTransactionDetail(currentSession, selected?.assetCode ?? null, selected);
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
        oldRead.resolve(pageResponse([wireTransaction("wallet-stale-secret")], "stale_cursor"));
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
          return pageResponse([wireTransaction("wallet-current")], "page_cursor");
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
