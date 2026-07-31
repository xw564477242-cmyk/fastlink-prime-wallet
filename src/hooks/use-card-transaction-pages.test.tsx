import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession, type FastLinkEnvironment } from "@/lib/backend-api";
import { CARD_TRANSACTION_PAGINATION_ERROR } from "@/lib/card-transaction-state";
import { useCardTransactionPages } from "./use-card-transaction-pages";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useCardTransactionPages>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;

function testEnvironment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Hook safety test requires SANDBOX or TEST");
  }
  if (backendRuntime.error || backendRuntime.apiUrl !== "/api") {
    throw new Error("Hook safety test requires the non-production /api runtime");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-card-history-hook-01",
    expiresAt: "2099-08-01T08:00:00.000Z",
    tenantId: "tenant-card-history-hook-01",
    customerId: "customer-card-history-hook-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function wireTransaction(id: string) {
  return {
    id,
    status: "SETTLED",
    amountMinor: "2500",
    authorizedAmountMinor: "2500",
    clearedAmountMinor: "2500",
    settledAmountMinor: "2500",
    reversedAmountMinor: "0",
    refundedAmountMinor: "0",
    currency: "USD",
    traceId: "trace-public-card-history-hook",
    merchantName: "Coffee",
    merchantCategory: "5812",
    occurredAt: "2026-07-31T12:00:00.000Z",
  };
}

function pageResponse(
  transactions: unknown[],
  nextCursor: unknown,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify({ transactions, nextCursor, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "trace-safe-hook" },
  });
}

function rawResponse(body: string, status = 200, traceId = "trace-safe-hook"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json", "x-trace-id": traceId },
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
  selectedCardId,
}: {
  currentSession: BackendSession | null;
  selectedCardId: string | null;
}) {
  latest = useCardTransactionPages(currentSession, selectedCardId);
  return null;
}

async function flushHook() {
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession, selectedCardId = "card:owned.1") {
  await act(async () => {
    renderer = create(createElement(Harness, { currentSession, selectedCardId }));
    await flushHook();
  });
  if (!latest) throw new Error("Hook did not render");
  return latest;
}

async function update(currentSession: BackendSession, selectedCardId = "card:owned.1") {
  if (!renderer) throw new Error("Hook renderer is not mounted");
  await act(async () => {
    renderer?.update(createElement(Harness, { currentSession, selectedCardId }));
    await flushHook();
  });
  if (!latest) throw new Error("Hook did not update");
  return latest;
}

async function settlePending(pending: Deferred<Response>, response: Response) {
  await act(async () => {
    pending.resolve(response);
    await pending.promise;
    await flushHook();
  });
}

async function rejectPending(pending: Deferred<Response>, reason: unknown) {
  await act(async () => {
    pending.reject(reason);
    await pending.promise.catch(() => undefined);
    await flushHook();
  });
}

async function unmount() {
  if (!renderer) return;
  await act(async () => {
    renderer?.unmount();
    await flushHook();
  });
  renderer = null;
  latest = null;
}

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

describe(`Selected Card transaction hook safety (${testEnvironment()})`, () => {
  it("hides old rows and cursor for every session and Card scope change before the new read settles", async () => {
    const changes: Array<{ label: string; next: BackendSession; cardId?: string }> = [
      { label: "actor", next: session({ actorId: "actor-card-history-hook-02" }) },
      { label: "expiry", next: session({ expiresAt: "2099-08-01T09:00:00.000Z" }) },
      { label: "tenant", next: session({ tenantId: "tenant-card-history-hook-02" }) },
      { label: "customer", next: session({ customerId: "customer-card-history-hook-02" }) },
      {
        label: "environment",
        next: session({ environment: alternateEnvironment(testEnvironment()) }),
      },
      { label: "Card", next: session(), cardId: "card:owned.2" },
    ];

    for (const change of changes) {
      const nextRead = deferred<Response>();
      let requestCount = 0;
      installFetch(() => {
        requestCount += 1;
        return requestCount === 1
          ? pageResponse([wireTransaction("transaction:accepted.1")], "cursor_old.signature")
          : nextRead.promise;
      });

      await mount(session());
      expect(latest?.transactions.map(({ id }) => id)).toEqual(["transaction:accepted.1"]);
      expect(latest?.nextCursor).toBe("cursor_old.signature");

      await update(change.next, change.cardId);
      expect(latest?.transactions, change.label).toEqual([]);
      expect(latest?.nextCursor, change.label).toBeNull();

      if (requestCount > 1) {
        await settlePending(nextRead, pageResponse([], null));
      }
      await unmount();
    }
  });

  it("ignores stale initial success and finally after the complete scope changes", async () => {
    const oldRead = deferred<Response>();
    const currentRead = deferred<Response>();
    let requestCount = 0;
    installFetch(() => (++requestCount === 1 ? oldRead.promise : currentRead.promise));

    await mount(session());
    await update(session({ customerId: "customer-card-history-hook-02" }), "card:owned.2");
    await settlePending(
      oldRead,
      pageResponse([wireTransaction("transaction:stale-secret-success")], "cursor_stale.signature"),
    );

    expect(latest?.transactions).toEqual([]);
    expect(latest?.nextCursor).toBeNull();
    expect(JSON.stringify(latest)).not.toContain("stale-secret-success");
    await settlePending(currentRead, pageResponse([], null));
  });

  it("ignores stale initial error and finally after the complete scope changes", async () => {
    const oldRead = deferred<Response>();
    const currentRead = deferred<Response>();
    let requestCount = 0;
    installFetch(() => (++requestCount === 1 ? oldRead.promise : currentRead.promise));

    await mount(session());
    await update(session({ actorId: "actor-card-history-hook-02" }));
    await rejectPending(oldRead, new Error("provider-stale-initial-secret"));

    expect(latest?.transactions).toEqual([]);
    expect(latest?.nextCursor).toBeNull();
    expect(latest?.error).toBeNull();
    expect(JSON.stringify(latest)).not.toContain("provider-stale-initial-secret");
    await settlePending(currentRead, pageResponse([], null));
  });

  it("ignores stale pagination success and finally after the complete scope changes", async () => {
    const oldPage = deferred<Response>();
    const currentRead = deferred<Response>();
    let requestCount = 0;
    installFetch(() => {
      requestCount += 1;
      if (requestCount === 1) {
        return pageResponse([wireTransaction("transaction:accepted.1")], "cursor_next.signature");
      }
      return requestCount === 2 ? oldPage.promise : currentRead.promise;
    });

    await mount(session());
    await act(async () => {
      void latest?.loadMore();
      await flushHook();
    });
    await update(session({ tenantId: "tenant-card-history-hook-02" }));
    await settlePending(
      oldPage,
      pageResponse([wireTransaction("transaction:stale-page-secret")], "cursor_stale.signature"),
    );

    expect(latest?.transactions).toEqual([]);
    expect(latest?.nextCursor).toBeNull();
    expect(JSON.stringify(latest)).not.toContain("stale-page-secret");
    await settlePending(currentRead, pageResponse([], null));
  });

  it("ignores stale pagination error and finally after the complete scope changes", async () => {
    const oldPage = deferred<Response>();
    const currentRead = deferred<Response>();
    let requestCount = 0;
    installFetch(() => {
      requestCount += 1;
      if (requestCount === 1) {
        return pageResponse([wireTransaction("transaction:accepted.1")], "cursor_next.signature");
      }
      return requestCount === 2 ? oldPage.promise : currentRead.promise;
    });

    await mount(session());
    await act(async () => {
      void latest?.loadMore();
      await flushHook();
    });
    await update(session({ expiresAt: "2099-08-01T09:00:00.000Z" }));
    await rejectPending(oldPage, new Error("provider-stale-page-secret"));

    expect(latest?.transactions).toEqual([]);
    expect(latest?.nextCursor).toBeNull();
    expect(latest?.error).toBeNull();
    expect(JSON.stringify(latest)).not.toContain("provider-stale-page-secret");
    await settlePending(currentRead, pageResponse([], null));
  });

  it("fails closed at the hook boundary for duplicate, invalid, oversized and internal payloads", async () => {
    const oversizedSecret = "oversized-provider-secret".repeat(4_000);
    const cases: Array<{ label: string; secret: string; response: () => Response }> = [
      {
        label: "duplicate IDs",
        secret: "transaction:duplicate.1",
        response: () =>
          pageResponse(
            [
              wireTransaction("transaction:duplicate.1"),
              wireTransaction("transaction:duplicate.1"),
            ],
            "cursor_duplicate.signature",
          ),
      },
      {
        label: "invalid raw JSON",
        secret: "invalid-provider-secret",
        response: () => rawResponse("{invalid-provider-secret"),
      },
      {
        label: "oversized raw JSON",
        secret: "oversized-provider-secret",
        response: () =>
          rawResponse(
            JSON.stringify({ transactions: [], nextCursor: null, providerDebug: oversizedSecret }),
          ),
      },
      {
        label: "extra page field",
        secret: "provider-internal-page-secret",
        response: () => pageResponse([], null, { providerDebug: "provider-internal-page-secret" }),
      },
      {
        label: "extra transaction field",
        secret: "provider-internal-row-secret",
        response: () =>
          pageResponse(
            [
              {
                ...wireTransaction("transaction:extra.1"),
                providerAccount: "provider-internal-row-secret",
              },
            ],
            null,
          ),
      },
      {
        label: "Provider error body",
        secret: "provider-error-body-secret",
        response: () =>
          rawResponse(
            JSON.stringify({ message: "provider-error-body-secret", providerCode: "PRIVATE_01" }),
            502,
            "trace-safe-provider",
          ),
      },
    ];

    for (const testCase of cases) {
      installFetch(testCase.response);
      await mount(session());

      expect(latest?.transactions, testCase.label).toEqual([]);
      expect(latest?.nextCursor, testCase.label).toBeNull();
      expect(latest?.error, testCase.label).not.toBeNull();
      expect(JSON.stringify(latest), testCase.label).not.toContain(testCase.secret);
      if (testCase.label === "Provider error body") {
        expect(latest?.error).toBe("Card transaction request failed · Trace trace-safe-provider");
      }
      await unmount();
    }
  });

  it("keeps accepted rows but closes pagination for every invalid next page", async () => {
    const cases: Array<{ label: string; secret: string; response: () => Response }> = [
      {
        label: "duplicate transaction ID",
        secret: "transaction:accepted.1",
        response: () =>
          pageResponse([wireTransaction("transaction:accepted.1")], "cursor_forward.signature"),
      },
      {
        label: "cursor loop",
        secret: "cursor_next.signature",
        response: () =>
          pageResponse([wireTransaction("transaction:new.2")], "cursor_next.signature"),
      },
      {
        label: "invalid raw JSON",
        secret: "pagination-invalid-provider-secret",
        response: () => rawResponse("{pagination-invalid-provider-secret"),
      },
      {
        label: "extra internal field",
        secret: "pagination-provider-internal-secret",
        response: () =>
          pageResponse([], "cursor_forward.signature", {
            providerDebug: "pagination-provider-internal-secret",
          }),
      },
      {
        label: "Provider error body",
        secret: "pagination-provider-error-secret",
        response: () =>
          rawResponse(
            JSON.stringify({ message: "pagination-provider-error-secret" }),
            503,
            "trace-safe-page-provider",
          ),
      },
    ];

    for (const testCase of cases) {
      let requestCount = 0;
      installFetch(() => {
        requestCount += 1;
        return requestCount === 1
          ? pageResponse([wireTransaction("transaction:accepted.1")], "cursor_next.signature")
          : testCase.response();
      });
      await mount(session());
      expect(latest?.transactions.map(({ id }) => id)).toEqual(["transaction:accepted.1"]);

      await act(async () => {
        await latest?.loadMore();
        await flushHook();
      });

      expect(
        latest?.transactions.map(({ id }) => id),
        testCase.label,
      ).toEqual(["transaction:accepted.1"]);
      expect(latest?.nextCursor, testCase.label).toBeNull();
      expect(latest?.error, testCase.label).not.toBeNull();
      if (testCase.label !== "duplicate transaction ID" && testCase.label !== "cursor loop") {
        expect(JSON.stringify(latest), testCase.label).not.toContain(testCase.secret);
      }
      if (testCase.label === "duplicate transaction ID" || testCase.label === "cursor loop") {
        expect(latest?.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
      }
      await unmount();
    }
  });
});
