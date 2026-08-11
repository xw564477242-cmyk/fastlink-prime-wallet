import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";
import { useDigitalAssetHistory } from "./use-digital-asset-history";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Result = ReturnType<typeof useDigitalAssetHistory>;
type Deferred<T> = { promise: Promise<T>; resolve(value: T): void };

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let result: Result | null = null;
const configuredEnvironment =
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Digital assets mounted test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(actorId = "actor-digital-01"): BackendSession {
  return {
    actorId,
    tenantId: `tenant-${actorId}`,
    customerId: `customer-${actorId}`,
    environment: environment(),
    expiresAt: "2099-08-03T00:00:00.000Z",
  };
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function response(value: unknown, status = 200, trace = "trace-digital") {
  return new Response(typeof value === "string" ? value : JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": trace },
  });
}

function assetResponse(assetClass: "FIAT" | "DIGITAL" = "DIGITAL") {
  return response({
    environment: environment(),
    items: [
      { assetCode: "USD", assetClass: "FIAT" },
      { assetCode: "USDT", assetClass },
    ],
  });
}

function account(id: string, assetCode: string, postedBalance = "10", pendingBalance = "2") {
  return {
    id,
    accountCode: `code-${id}`,
    name: `${assetCode} Wallet`,
    assetCode,
    status: "ACTIVE",
    currentBalance: String(Number(postedBalance) + Number(pendingBalance)),
    postedBalance,
    pendingBalance,
    availableBalance: postedBalance,
    updatedAt: "2026-08-03T12:00:00.000Z",
  };
}

function transaction(id: string, amount = "1.25", createdAt = "2026-08-03T12:00:00.000Z") {
  return {
    id,
    operationId: null,
    cardId: "card-digital-01",
    cardType: "VIRTUAL",
    type: "TRANSFER",
    status: "COMPLETED",
    assetCode: "USDT",
    amount,
    direction: "INCOMING",
    createdAt,
    updatedAt: createdAt,
  };
}

function fullTransactionPage(prefix: string) {
  return Array.from({ length: 25 }, (_, index) =>
    transaction(
      `${prefix}-${String(index).padStart(2, "0")}`,
      "1.25",
      new Date(Date.UTC(2026, 7, 3, 12, 0, 59 - index)).toISOString(),
    ),
  );
}

function Harness({
  currentSession,
  invalidate,
}: {
  currentSession: BackendSession | null;
  invalidate?: BackendSessionInvalidator;
}) {
  result = useDigitalAssetHistory(currentSession, {}, invalidate);
  return null;
}

function installFetch(responder: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), "https://wallet.invalid");
    calls.push({ url, init });
    return responder(url, init);
  }) as typeof globalThis.fetch;
  return calls;
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function unmount() {
  if (!renderer) return;
  await act(async () => {
    renderer?.unmount();
    await flush();
  });
  renderer = null;
  result = null;
}

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Digital asset mounted isolation (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("atomically intersects DIGITAL metadata with session-owned accounts and reads exact account history", async () => {
      const calls = installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) return assetResponse();
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          return response([account("account-usd", "USD"), account("account-usdt", "USDT")]);
        }
        if (url.pathname.endsWith("/v1/wallet/accounts/account-usdt/transactions")) {
          return response({ items: [transaction("tx-usdt")], nextCursor: null });
        }
        throw new Error(`Unexpected request ${url}`);
      });

      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: session() }));
        await flush();
      });

      expect(result?.assets.accounts.map(({ id }) => id)).toEqual(["account-usdt"]);
      expect(result?.assets.selectedAccount?.availableBalance).toBe("10");
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-usdt"]);
      const history = calls.find(({ url }) => url.pathname.endsWith("/transactions"));
      expect(history).toBeDefined();
      expect(Object.fromEntries(history!.url.searchParams)).toEqual({
        assetCode: "USDT",
        limit: "25",
      });
      expect(calls.every(({ init }) => init?.credentials === "include")).toBe(true);
      expect(calls.every(({ init }) => (init?.method ?? "GET") === "GET")).toBe(true);
    });

    it("preserves the prior atomic snapshot until both metadata and accounts refresh", async () => {
      const nextCatalog = deferred<Response>();
      let assetReads = 0;
      let accountReads = 0;
      installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) {
          assetReads += 1;
          return assetReads === 1 ? assetResponse() : nextCatalog.promise;
        }
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          accountReads += 1;
          return response([account("account-usdt", "USDT", accountReads === 1 ? "10" : "40")]);
        }
        return response({ items: [], nextCursor: null });
      });
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: session() }));
        await flush();
      });
      expect(result?.assets.selectedAccount?.availableBalance).toBe("10");

      await act(async () => {
        result?.refreshAssets();
        await flush();
      });
      expect(result?.assets.refreshing).toBe(true);
      expect(result?.assets.selectedAccount?.availableBalance).toBe("10");

      await act(async () => {
        nextCatalog.resolve(assetResponse());
        await flush();
      });
      expect(result?.assets.refreshing).toBe(false);
      expect(result?.assets.selectedAccount?.availableBalance).toBe("40");
    });

    it("replaces history atomically on manual refresh without appending stale items", async () => {
      let historyReads = 0;
      installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) return assetResponse();
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          return response([account("account-usdt", "USDT")]);
        }
        historyReads += 1;
        return response({
          items: [transaction(historyReads === 1 ? "tx-old" : "tx-new")],
          nextCursor: null,
        });
      });
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: session() }));
        await flush();
      });
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-old"]);

      await act(async () => {
        result?.refreshHistory();
        await flush();
      });
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-new"]);
      expect(historyReads).toBe(2);
    });

    it("appends only the page returned for the exact signed account cursor", async () => {
      const cursor = "Y3Vyc29y.c2ln";
      const calls = installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) return assetResponse();
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          return response([account("account-usdt", "USDT")]);
        }
        return url.searchParams.get("cursor") === cursor
          ? response({
              items: [transaction("tx-page-2", "2.5", "2026-08-03T11:00:00.000Z")],
              nextCursor: null,
            })
          : response({ items: fullTransactionPage("tx-page-1"), nextCursor: cursor });
      });
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: session() }));
        await flush();
      });
      expect(result?.transactions.items).toHaveLength(25);
      expect(result?.transactions.nextCursor).toBe(cursor);

      await act(async () => {
        await result?.loadMore();
        await flush();
      });
      expect(result?.transactions.items).toHaveLength(26);
      expect(result?.transactions.items.at(-1)?.id).toBe("tx-page-2");
      const paged = calls.find(({ url }) => url.searchParams.get("cursor") === cursor);
      expect(paged?.url.pathname).toEndWith("/v1/wallet/accounts/account-usdt/transactions");
      expect(Object.fromEntries(paged!.url.searchParams)).toEqual({
        assetCode: "USDT",
        limit: "25",
        cursor,
      });
    });

    it("aborts and discards a late history page after the selected owned account changes", async () => {
      const oldHistory = deferred<Response>();
      const calls = installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) return assetResponse();
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          return response([
            account("account-old", "USDT"),
            account("account-current", "USDT", "55"),
          ]);
        }
        if (url.pathname.includes("/account-old/")) return oldHistory.promise;
        if (url.pathname.includes("/account-current/")) {
          return response({ items: [transaction("tx-current")], nextCursor: null });
        }
        throw new Error(`Unexpected request ${url}`);
      });
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: session() }));
        await flush();
      });
      expect(result?.assets.selectedAccount?.id).toBe("account-old");

      await act(async () => {
        result?.selectAccount("account-current");
        await flush();
      });
      const oldCall = calls.find(({ url }) => url.pathname.includes("/account-old/"));
      expect(oldCall?.init?.signal?.aborted).toBe(true);
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-current"]);

      await act(async () => {
        oldHistory.resolve(response({ items: [transaction("tx-stale-secret")], nextCursor: null }));
        await flush();
      });
      expect(JSON.stringify(result)).not.toContain("tx-stale-secret");
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-current"]);
    });

    it("aborts superseded Session work and rejects every late balance and history write", async () => {
      const oldAssets = deferred<Response>();
      const oldAccounts = deferred<Response>();
      let assetReads = 0;
      let accountReads = 0;
      const calls = installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) {
          assetReads += 1;
          return assetReads === 1 ? oldAssets.promise : assetResponse();
        }
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          accountReads += 1;
          return accountReads === 1
            ? oldAccounts.promise
            : response([account("account-current", "USDT", "55")]);
        }
        return response({ items: [transaction("tx-current")], nextCursor: null });
      });
      const firstSession = session("actor-old");
      const currentSession = session("actor-current");
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: firstSession }));
        await flush();
      });
      await act(async () => {
        renderer?.update(createElement(Harness, { currentSession }));
        await flush();
      });
      expect(calls[0]?.init?.signal?.aborted).toBe(true);
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      expect(result?.assets.selectedAccount?.id).toBe("account-current");

      await act(async () => {
        oldAssets.resolve(assetResponse());
        oldAccounts.resolve(response([account("account-stale-secret", "USDT", "999")]));
        await flush();
      });
      expect(JSON.stringify(result)).not.toContain("account-stale-secret");
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-current"]);
    });

    it("invalidates only the exact current Session on an explicit 401", async () => {
      const invalidations: Array<{ session: BackendSession; reason: string }> = [];
      const currentSession = session();
      installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) {
          return response({ code: "UNAUTHORIZED" }, 401, "trace-401");
        }
        return response([account("account-usdt", "USDT")]);
      });
      await act(async () => {
        renderer = create(
          createElement(Harness, {
            currentSession,
            invalidate: (invalidated, reason) =>
              invalidations.push({ session: invalidated, reason }),
          }),
        );
        await flush();
      });
      expect(invalidations).toEqual([{ session: currentSession, reason: "EXPLICIT_401" }]);
      expect(result?.assets.accounts).toEqual([]);
    });

    it("clears a verified history snapshot before invalidating on a refresh 401", async () => {
      const invalidations: Array<{ session: BackendSession; reason: string }> = [];
      const currentSession = session();
      let historyReads = 0;
      installFetch((url) => {
        if (url.pathname.endsWith("/v1/wallet/assets")) return assetResponse();
        if (url.pathname.endsWith("/v1/wallet/accounts")) {
          return response([account("account-usdt", "USDT")]);
        }
        historyReads += 1;
        return historyReads === 1
          ? response({ items: [transaction("tx-verified")], nextCursor: null })
          : response({ code: "UNAUTHORIZED" }, 401, "trace-history-401");
      });
      await act(async () => {
        renderer = create(
          createElement(Harness, {
            currentSession,
            invalidate: (invalidated, reason) =>
              invalidations.push({ session: invalidated, reason }),
          }),
        );
        await flush();
      });
      expect(result?.transactions.items.map(({ id }) => id)).toEqual(["tx-verified"]);

      await act(async () => {
        result?.refreshHistory();
        await flush();
      });
      expect(result?.transactions.items).toEqual([]);
      expect(invalidations).toEqual([{ session: currentSession, reason: "EXPLICIT_401" }]);
    });
  },
);
