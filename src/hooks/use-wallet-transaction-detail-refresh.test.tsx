import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  backendRuntime,
  type BackendSession,
  type WalletAccountTransaction,
} from "@/lib/backend-api";
import { useWalletTransactionDetail } from "./use-wallet-transaction-detail";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useWalletTransactionDetail>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;
const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Wallet detail refresh mounted test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-wallet-detail-refresh",
    tenantId: "tenant-wallet-detail-refresh",
    customerId: "customer-wallet-detail-refresh",
    environment: environment(),
    expiresAt: "2099-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(
  id = "wallet-txn-refresh-1",
  patch: Partial<WalletAccountTransaction> = {},
): WalletAccountTransaction {
  return {
    id,
    type: "transfer",
    status: "completed",
    assetCode: "USD",
    amount: "25.5",
    direction: "outgoing",
    createdAt: "2026-07-31T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:01.000Z",
    ...patch,
  };
}

function wireTransaction(item: WalletAccountTransaction) {
  return {
    id: item.id,
    type: item.type.toUpperCase(),
    status: item.status.toUpperCase(),
    assetCode: item.assetCode,
    amount: item.amount,
    direction: item.direction.toUpperCase(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function response(item: WalletAccountTransaction): Response {
  return new Response(JSON.stringify(wireTransaction(item)), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "trace-detail-refresh" },
  });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
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

function Harness({
  currentSession,
  selected,
  historyScopeKey,
}: {
  currentSession: BackendSession | null;
  selected: WalletAccountTransaction | null;
  historyScopeKey: string | null;
}) {
  latest = useWalletTransactionDetail(
    currentSession,
    selected?.assetCode ?? null,
    selected,
    historyScopeKey,
  );
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(
  currentSession: BackendSession,
  selected: WalletAccountTransaction,
  historyScopeKey = "wallet-history-filter-v1",
) {
  await act(async () => {
    renderer = create(createElement(Harness, { currentSession, selected, historyScopeKey }));
    await flush();
  });
}

async function update(
  currentSession: BackendSession,
  selected: WalletAccountTransaction,
  historyScopeKey = "wallet-history-filter-v1",
) {
  await act(async () => {
    renderer?.update(createElement(Harness, { currentSession, selected, historyScopeKey }));
    await flush();
  });
}

async function unmount() {
  if (!renderer) return;
  await act(async () => {
    renderer?.unmount();
    await flush();
  });
  renderer = null;
  latest = null;
}

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Mounted Wallet transaction detail refresh (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("uses one exact public GET and a manual refresh cancels the previous generation", async () => {
      const firstRefresh = deferred<Response>();
      const currentRefresh = deferred<Response>();
      let reads = 0;
      const calls = installFetch(() => {
        reads += 1;
        if (reads === 1) return response(transaction());
        return reads === 2 ? firstRefresh.promise : currentRefresh.promise;
      });
      const currentSession = session();
      await mount(currentSession, transaction());
      expect(latest?.detail?.id).toBe("wallet-txn-refresh-1");
      expect(latest?.canRefresh).toBe(true);

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      await act(async () => {
        latest?.refresh();
        await flush();
      });

      expect(calls).toHaveLength(3);
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      for (const call of calls) {
        expect(String(call.input)).toBe("/api/v1/wallet/transactions/wallet-txn-refresh-1");
        expect(call.init?.method ?? "GET").toBe("GET");
      }

      const refreshed = transaction("wallet-txn-refresh-1", {
        status: "reversed",
        updatedAt: "2026-07-31T12:10:00.000Z",
      });
      await act(async () => {
        currentRefresh.resolve(response(refreshed));
        await currentRefresh.promise;
        await flush();
      });
      expect(latest?.detail).toEqual(refreshed);

      await act(async () => {
        firstRefresh.reject(new Error("provider-stale-refresh-secret"));
        await firstRefresh.promise.catch(() => undefined);
        await flush();
      });
      expect(latest?.detail).toEqual(refreshed);
      expect(latest?.error).toBeNull();
      expect(JSON.stringify(latest)).not.toContain("provider-stale-refresh-secret");
    });

    it("aborts and hides stale detail for filter scope, session and public record version changes", async () => {
      const changes = [
        {
          label: "selection",
          nextSession: session(),
          nextTransaction: transaction("wallet-txn-refresh-2"),
          nextHistoryScope: "wallet-history-filter-v1",
        },
        {
          label: "filter scope",
          nextSession: session(),
          nextTransaction: transaction(),
          nextHistoryScope: "wallet-history-filter-v2",
        },
        {
          label: "session",
          nextSession: session({ customerId: "customer-wallet-detail-refresh-2" }),
          nextTransaction: transaction(),
          nextHistoryScope: "wallet-history-filter-v1",
        },
        {
          label: "record version",
          nextSession: session(),
          nextTransaction: transaction("wallet-txn-refresh-1", {
            status: "pending",
            updatedAt: "2026-07-31T12:00:02.000Z",
          }),
          nextHistoryScope: "wallet-history-filter-v1",
        },
      ] as const;

      for (const change of changes) {
        const oldRead = deferred<Response>();
        const currentRead = deferred<Response>();
        let reads = 0;
        const calls = installFetch(() => (++reads === 1 ? oldRead.promise : currentRead.promise));
        await mount(session(), transaction());
        await update(change.nextSession, change.nextTransaction, change.nextHistoryScope);

        expect(calls[0]?.init?.signal?.aborted, change.label).toBe(true);
        expect(latest?.detail, change.label).toBeNull();
        await act(async () => {
          oldRead.resolve(response(transaction()));
          await oldRead.promise;
          await flush();
        });
        expect(latest?.detail, change.label).toBeNull();
        await unmount();
        expect(calls[1]?.init?.signal?.aborted, change.label).toBe(true);
        currentRead.resolve(response(change.nextTransaction));
      }
    });

    it("actively aborts an in-flight detail read on unmount", async () => {
      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      await mount(session(), transaction());
      await unmount();
      expect(calls[0]?.init?.signal?.aborted).toBe(true);
      pending.resolve(response(transaction()));
    });
  },
);
