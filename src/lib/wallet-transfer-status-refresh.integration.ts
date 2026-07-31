import { afterEach, describe, expect, it } from "bun:test";
import {
  backendRuntime,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletOperationActivity,
} from "./backend-api";
import {
  SAFE_STATUS_REFRESH_ERROR,
  readWalletTransferStatusSafely,
} from "../hooks/use-wallet-transfer-status-refresh";
import {
  acceptsWalletTransferStatusRefreshCompletion,
  beginWalletTransferStatusRefresh,
  createWalletTransferStatusRefreshGate,
  initialWalletTransferStatusRefreshState,
  settleWalletTransferStatusRefresh,
  syncWalletTransferStatusRefreshScope,
  walletTransferStatusRefreshReducer,
  walletTransferStatusRefreshScopeKey,
  type WalletTransferReceiptContext,
} from "./wallet-transfer-status-refresh-state";

type FetchCall = Readonly<{ input: string | URL | Request; init?: RequestInit }>;

const originalFetch = globalThis.fetch;
const createdAt = "2026-08-01T00:00:00.000Z";
const completedAt = "2026-08-01T00:01:00.000Z";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function testEnvironment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Integration test requires an authenticated SANDBOX or TEST runtime");
  }
  if (backendRuntime.error || backendRuntime.apiUrl !== "/api") {
    throw new Error("Integration test requires the non-production /api runtime");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-integration-01",
    tenantId: "tenant-integration-01",
    customerId: "customer-integration-01",
    environment: testEnvironment(),
    expiresAt: "2099-08-01T08:00:00.000Z",
    ...overrides,
  };
}

function operation(overrides: Partial<WalletOperationActivity> = {}): WalletOperationActivity {
  return {
    id: "operation-integration-01",
    type: "internal_transfer",
    status: "processing",
    assetCode: "USD",
    amount: "25",
    direction: "outgoing",
    createdAt,
    completedAt: null,
    updatedAt: createdAt,
    ...overrides,
  };
}

function receipt(
  overrides: Partial<WalletTransferReceiptContext> = {},
): WalletTransferReceiptContext {
  return {
    sourceAccountId: "account-source-integration-01",
    destinationAccountId: "account-target-integration-02",
    amount: "25",
    transferRequestKey: "transfer-request-integration-generation-01",
    transferGeneration: 1,
    operation: operation(),
    ...overrides,
  };
}

function completedWireResponse(): string {
  return JSON.stringify({
    id: "operation-integration-01",
    type: "INTERNAL_TRANSFER",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25",
    direction: "OUTGOING",
    createdAt,
    completedAt,
    updatedAt: completedAt,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

describe(`Wallet transfer manual refresh integration safety (${testEnvironment()})`, () => {
  it("performs one explicit authenticated GET on the real public operation path", async () => {
    const calls = installFetch(
      () =>
        new Response(completedWireResponse(), {
          status: 200,
          headers: { "content-type": "application/json", "x-trace-id": "trace-public-read" },
        }),
    );
    const currentSession = session();
    const context = receipt();
    const scopeKey = walletTransferStatusRefreshScopeKey(
      currentSession,
      testEnvironment(),
      context,
    );
    expect(scopeKey).not.toBeNull();

    const gate = createWalletTransferStatusRefreshGate(scopeKey);
    const ticket = beginWalletTransferStatusRefresh(gate, scopeKey!);
    expect(ticket).not.toBeNull();
    expect(calls).toHaveLength(0);

    const result = await readWalletTransferStatusSafely(currentSession, context.operation);
    expect(result.ok).toBe(true);
    expect(acceptsWalletTransferStatusRefreshCompletion(gate, ticket!, scopeKey)).toBe(true);
    expect(settleWalletTransferStatusRefresh(gate, ticket!, scopeKey)).toBe(true);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(String(call.input)).toBe("/api/v1/wallet/operations/operation-integration-01");
    expect((call.init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(call.init?.credentials).toBe("include");
    expect(call.init?.cache).toBe("no-store");
    expect(call.init?.body).toBeUndefined();
    const headers = new Headers(call.init?.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-trace-id")).toBeTruthy();
    expect(headers.has("idempotency-key")).toBe(false);
    expect(headers.has("x-csrf-token")).toBe(false);
    expect(String(call.input)).not.toContain("/v1/wallet/transfers");
  });

  it("denies a session/runtime mismatch before any request and discloses no scope data", () => {
    const calls = installFetch(() => {
      throw new Error("fetch must not run for an invalid scope");
    });
    const mismatched = session({ environment: alternateEnvironment(testEnvironment()) });
    const scopeKey = walletTransferStatusRefreshScopeKey(mismatched, testEnvironment(), receipt());
    expect(scopeKey).toBeNull();
    expect(createWalletTransferStatusRefreshGate(scopeKey)).toEqual({
      scopeKey: null,
      generation: 0,
      activeRequestKey: null,
    });
    expect(calls).toHaveLength(0);
    expect(JSON.stringify({ allowed: scopeKey !== null })).not.toContain(mismatched.actorId);
    expect(JSON.stringify({ allowed: scopeKey !== null })).not.toContain(mismatched.tenantId);
    expect(JSON.stringify({ allowed: scopeKey !== null })).not.toContain(mismatched.customerId);
  });

  it("suppresses every stale identity, environment, operation and generation completion", async () => {
    const staleCases = [
      "actor",
      "tenant",
      "customer",
      "environment",
      "operation",
      "generation",
    ] as const;

    for (const staleCase of staleCases) {
      const response = deferred<Response>();
      const calls = installFetch(() => response.promise);
      const initialSession = session();
      const initialContext = receipt();
      const initialScope = walletTransferStatusRefreshScopeKey(
        initialSession,
        testEnvironment(),
        initialContext,
      );
      expect(initialScope).not.toBeNull();
      const gate = createWalletTransferStatusRefreshGate(initialScope);
      const oldTicket = beginWalletTransferStatusRefresh(gate, initialScope!);
      expect(oldTicket).not.toBeNull();

      let state = walletTransferStatusRefreshReducer(initialWalletTransferStatusRefreshState, {
        type: "reset",
        scopeKey: initialScope,
      });
      state = walletTransferStatusRefreshReducer(state, {
        type: "started",
        scopeKey: initialScope!,
        requestKey: oldTicket!.requestKey,
      });
      const pending = readWalletTransferStatusSafely(initialSession, initialContext.operation);

      let currentScope = initialScope;
      if (staleCase === "actor") {
        currentScope = walletTransferStatusRefreshScopeKey(
          session({ actorId: "actor-integration-02" }),
          testEnvironment(),
          initialContext,
        );
      } else if (staleCase === "tenant") {
        currentScope = walletTransferStatusRefreshScopeKey(
          session({ tenantId: "tenant-integration-02" }),
          testEnvironment(),
          initialContext,
        );
      } else if (staleCase === "customer") {
        currentScope = walletTransferStatusRefreshScopeKey(
          session({ customerId: "customer-integration-02" }),
          testEnvironment(),
          initialContext,
        );
      } else if (staleCase === "environment") {
        currentScope = walletTransferStatusRefreshScopeKey(
          session({ environment: alternateEnvironment(testEnvironment()) }),
          testEnvironment(),
          initialContext,
        );
      } else if (staleCase === "operation") {
        currentScope = walletTransferStatusRefreshScopeKey(
          initialSession,
          testEnvironment(),
          receipt({
            operation: operation({ status: "pending_settlement", updatedAt: completedAt }),
          }),
        );
      }

      if (staleCase === "generation") {
        syncWalletTransferStatusRefreshScope(gate, null);
        syncWalletTransferStatusRefreshScope(gate, initialScope);
        const replacementTicket = beginWalletTransferStatusRefresh(gate, initialScope!);
        expect(replacementTicket).not.toBeNull();
        state = walletTransferStatusRefreshReducer(state, {
          type: "started",
          scopeKey: initialScope!,
          requestKey: replacementTicket!.requestKey,
        });
      } else {
        syncWalletTransferStatusRefreshScope(gate, currentScope);
        state = walletTransferStatusRefreshReducer(state, {
          type: "reset",
          scopeKey: currentScope,
        });
      }
      const beforeCompletion = state;

      response.resolve(
        new Response(completedWireResponse(), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const result = await pending;
      expect(result.ok).toBe(true);
      expect(acceptsWalletTransferStatusRefreshCompletion(gate, oldTicket!, currentScope)).toBe(
        false,
      );
      expect(settleWalletTransferStatusRefresh(gate, oldTicket!, currentScope)).toBe(false);
      expect(state).toBe(beforeCompletion);
      expect(calls).toHaveLength(1);
    }
  });

  it("does not retry and returns one stable non-reflective error", async () => {
    const upstreamSecrets = [
      "provider-account-secret-01",
      "tenant-integration-01",
      "customer-integration-01",
    ];
    const calls = installFetch(
      () =>
        new Response(
          JSON.stringify({
            message: `Provider failed ${upstreamSecrets.join(" ")}`,
            providerReference: "real-provider-reference-must-not-surface",
          }),
          { status: 502, headers: { "x-trace-id": "upstream-secret-trace" } },
        ),
    );

    const result = await readWalletTransferStatusSafely(session(), operation());
    expect(result).toEqual({ ok: false, message: SAFE_STATUS_REFRESH_ERROR });
    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify(result);
    for (const secret of upstreamSecrets) expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("real-provider-reference");
    expect(serialized).not.toContain("upstream-secret-trace");
  });

  it("fails closed on an unexpected successful payload without retry or mutation", async () => {
    const calls = installFetch(
      () =>
        new Response(
          JSON.stringify({
            ...JSON.parse(completedWireResponse()),
            providerReference: "must-not-reflect",
          }),
          { status: 200 },
        ),
    );
    const result = await readWalletTransferStatusSafely(session(), operation());
    expect(result).toEqual({ ok: false, message: SAFE_STATUS_REFRESH_ERROR });
    expect(calls).toHaveLength(1);
    expect((calls[0].init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(calls[0].init?.body).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("providerReference");
    expect(JSON.stringify(result)).not.toContain("must-not-reflect");
  });
});
