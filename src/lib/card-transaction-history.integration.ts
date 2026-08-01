import { afterEach, describe, expect, it } from "bun:test";
import {
  BackendApiError,
  CARD_TRANSACTION_STATUSES,
  backendApi,
  backendRuntime,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCardTransaction,
} from "./backend-api";
import {
  cardTransactionReducer,
  cardTransactionRequestKey,
  initialCardTransactionState,
} from "./card-transaction-state";

type FetchCall = Readonly<{ input: string | URL | Request; init?: RequestInit }>;

const originalFetch = globalThis.fetch;
const signedCursor = (payload: string) =>
  `${Buffer.from(payload).toString("base64url")}.${Buffer.alloc(32).toString("base64url")}`;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function testEnvironment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Integration test requires SANDBOX or TEST");
  }
  if (backendRuntime.error || backendRuntime.apiUrl !== "/api") {
    throw new Error("Integration test requires the non-production /api runtime");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-card-history-01",
    expiresAt: "2099-08-01T08:00:00.000Z",
    tenantId: "tenant-card-history-01",
    customerId: "customer-card-history-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function wireTransaction(id: string, status = "SETTLED") {
  return {
    id,
    status,
    amountMinor: "2500",
    authorizedAmountMinor: "2500",
    clearedAmountMinor: "2500",
    settledAmountMinor: "2500",
    reversedAmountMinor: "0",
    refundedAmountMinor: "0",
    currency: "USD",
    traceId: "trace-card-history-01",
    merchantName: "Coffee",
    merchantCategory: "5812",
    occurredAt: "2026-07-31T12:00:00.000Z",
  };
}

function response(transactions: unknown[], nextCursor: unknown): Response {
  return new Response(JSON.stringify({ transactions, nextCursor }), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "trace-public-read" },
  });
}

function installFetch(responder: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { input, init };
    calls.push(call);
    return responder(call);
  }) as typeof globalThis.fetch;
  return calls;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

describe(`Selected Card transaction history integration (${testEnvironment()})`, () => {
  it("performs one authenticated read and exposes only the Wallet allowlist", async () => {
    const calls = installFetch(() => response([wireTransaction("transaction-public-01")], null));
    const page = await backendApi.cardTransactions(session(), "card:owned.1", { limit: 2 });

    expect(page.transactions[0]).toEqual({
      id: "transaction-public-01",
      status: "settled",
      amountMinor: "2500",
      currency: "USD",
      merchant: "Coffee",
      category: "5812",
      timestamp: "2026-07-31T12:00:00.000Z",
    });
    expect(JSON.stringify(page)).not.toMatch(
      /traceId|authorizedAmountMinor|clearedAmountMinor|settledAmountMinor|provider|journal/,
    );
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.input)).toBe("/api/v1/cards/card%3Aowned.1/transactions?limit=2");
    expect((calls[0]?.init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(calls[0]?.init?.credentials).toBe("include");
    expect(calls[0]?.init?.cache).toBe("no-store");
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  it("passes the signed public cursor unchanged and binds its requested limit", async () => {
    const cursor = signedCursor("protected_payload");
    const calls = installFetch(() => response([], null));
    await backendApi.cardTransactions(session(), "card:owned.1", { limit: 2, cursor });
    expect(String(calls[0]?.input)).toBe(
      `/api/v1/cards/card%3Aowned.1/transactions?limit=2&cursor=${cursor}`,
    );
  });

  it("binds each concrete status to the exact GET and rejects cross-filter rows", async () => {
    for (const status of CARD_TRANSACTION_STATUSES) {
      const calls = installFetch(() =>
        response([wireTransaction(`transaction-${status}`, status)], null),
      );
      const page = await backendApi.cardTransactions(session(), "card:owned.1", {
        limit: 2,
        status,
      });
      const url = new URL(String(calls[0]?.input), "https://wallet.invalid");
      expect(Object.fromEntries(url.searchParams), status).toEqual({ limit: "2", status });
      expect((calls[0]?.init?.method ?? "GET").toUpperCase(), status).toBe("GET");
      expect(calls[0]?.init?.body, status).toBeUndefined();
      expect(page.transactions[0]?.status, status).toBe(
        status.toLowerCase() as WalletCardTransaction["status"],
      );
    }

    installFetch(() => response([wireTransaction("transaction-cross-filter")], null));
    await expect(
      backendApi.cardTransactions(session(), "card:owned.1", { status: "DECLINED" }),
    ).rejects.toThrow("outside the active status filter");
  });

  it("denies mismatched or expired sessions before fetch", async () => {
    const calls = installFetch(() => {
      throw new Error("fetch must not run");
    });
    await expect(
      backendApi.cardTransactions(
        session({ environment: alternateEnvironment(testEnvironment()) }),
        "card:owned.1",
      ),
    ).rejects.toBeInstanceOf(BackendApiError);
    await expect(
      backendApi.cardTransactions(
        session({ expiresAt: "2020-01-01T00:00:00.000Z" }),
        "card:owned.1",
      ),
    ).rejects.toBeInstanceOf(BackendApiError);
    expect(calls).toHaveLength(0);
  });

  it("fails closed for missing or illegal nextCursor and reflects no upstream error", async () => {
    const invalidCalls = installFetch(
      () =>
        new Response(JSON.stringify({ transactions: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(backendApi.cardTransactions(session(), "card:owned.1")).rejects.toThrow(
      "invalid transaction page",
    );
    expect(invalidCalls).toHaveLength(1);

    const errorCalls = installFetch(
      () =>
        new Response(
          JSON.stringify({
            message: "provider-account-secret journal-secret must-never-render",
          }),
          { status: 502, headers: { "x-trace-id": "trace-safe-502" } },
        ),
    );
    await expect(backendApi.cardTransactions(session(), "card:owned.1")).rejects.toThrow(
      "Card transaction request failed · Trace trace-safe-502",
    );
    expect(errorCalls).toHaveLength(1);
  });

  it("rejects stale success, error and finally for initial and pagination generations", () => {
    const scope = JSON.stringify([
      "actor-card-history-01",
      "2099-08-01T08:00:00.000Z",
      "tenant-card-history-01",
      "customer-card-history-01",
      testEnvironment(),
      "card:owned.1",
    ]);
    const initialKey = cardTransactionRequestKey(scope, null, 1);
    const replacementKey = cardTransactionRequestKey(scope, null, 2);
    const current = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: scope,
      requestKey: replacementKey,
      loading: true,
    });
    const stalePage = cardTransactionReducer(current, {
      type: "page",
      requestKey: initialKey,
      requestCursor: null,
      page: { transactions: [], nextCursor: null },
      append: false,
    });
    const staleError = cardTransactionReducer(current, {
      type: "failed",
      requestKey: initialKey,
      message: "stale",
      append: false,
    });
    const staleFinally = cardTransactionReducer(current, {
      type: "settled",
      requestKey: initialKey,
    });
    expect(stalePage).toBe(current);
    expect(staleError).toBe(current);
    expect(staleFinally).toBe(current);

    const firstPage = cardTransactionReducer(current, {
      type: "page",
      requestKey: replacementKey,
      requestCursor: null,
      page: {
        transactions: [
          {
            id: "transaction-public-01",
            status: "settled",
            amountMinor: "2500",
            currency: "USD",
            merchant: "Coffee",
            category: "5812",
            timestamp: "2026-07-31T12:00:00.000Z",
          },
        ],
        nextCursor: "protected_payload.signature",
      },
      append: false,
    });
    const pageKey = cardTransactionRequestKey(scope, "protected_payload.signature", 3);
    const loadingMore = cardTransactionReducer(firstPage, {
      type: "loading-more",
      requestKey: pageKey,
      requestCursor: "protected_payload.signature",
    });
    const stalePaginationPage = cardTransactionReducer(loadingMore, {
      type: "page",
      requestKey: replacementKey,
      requestCursor: "protected_payload.signature",
      page: { transactions: [], nextCursor: null },
      append: true,
    });
    const stalePaginationError = cardTransactionReducer(loadingMore, {
      type: "failed",
      requestKey: replacementKey,
      message: "stale pagination",
      append: true,
    });
    const stalePaginationFinally = cardTransactionReducer(loadingMore, {
      type: "settled",
      requestKey: replacementKey,
    });
    expect(stalePaginationPage).toBe(loadingMore);
    expect(stalePaginationError).toBe(loadingMore);
    expect(stalePaginationFinally).toBe(loadingMore);
  });
});
