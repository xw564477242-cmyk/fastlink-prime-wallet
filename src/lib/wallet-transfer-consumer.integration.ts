import { afterEach, describe, expect, it } from "bun:test";
import {
  BackendApiError,
  backendApi,
  backendRuntime,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletTransferAccount,
} from "./backend-api";
import {
  initialWalletTransferAccountState,
  walletTransferAccountReducer,
  walletTransferAccountScopeKey,
} from "./wallet-transfer-account-state";
import {
  beginWalletTransferMutation,
  createWalletTransferMutationGate,
  initialWalletTransferMutationState,
  syncWalletTransferMutationScope,
  walletTransferMutationReducer,
  walletTransferMutationScopeKey,
} from "./wallet-transfer-mutation-state";

type FetchCall = Readonly<{ input: string | URL | Request; init?: RequestInit }>;

const originalFetch = globalThis.fetch;
const updatedAt = "2026-08-01T00:00:00.000Z";

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
    actorId: "actor-transfer-integration-01",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-transfer-integration-01",
    customerId: "customer-transfer-integration-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function accountWire(id = "account-source-01") {
  return {
    id,
    accountCode: "CUSTOMER:SOURCE:USD",
    name: "Source Wallet",
    assetCode: "USD",
    status: "ACTIVE",
    currentBalance: "100",
    postedBalance: "100",
    pendingBalance: "0",
    availableBalance: "100",
    updatedAt,
  };
}

function source(): WalletTransferAccount {
  return {
    id: "account-source-01",
    assetCode: "USD",
    status: "active",
    currentBalance: "100",
    postedBalance: "100",
    pendingBalance: "0",
    availableBalance: "100",
    updatedAt,
  };
}

function operationWire() {
  return {
    id: "operation-transfer-01",
    type: "INTERNAL_TRANSFER",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25",
    direction: "OUTGOING",
    createdAt: updatedAt,
    completedAt: updatedAt,
    updatedAt,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-transfer-safe" },
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

describe(`Internal Wallet transfer consumer integration (${testEnvironment()})`, () => {
  it("reads allowlisted accounts then submits one exact authenticated transfer", async () => {
    const calls = installFetch((call) =>
      String(call.input).endsWith("/v1/wallet/accounts")
        ? jsonResponse([accountWire()])
        : jsonResponse(operationWire(), 201),
    );
    const currentSession = session();
    const accounts = await backendApi.walletTransferAccounts(currentSession);
    const operation = await backendApi.createWalletTransfer(
      currentSession,
      accounts[0]!,
      { destinationAccountId: "account-destination-02", amount: "25.000" },
      "123e4567-e89b-42d3-a456-426614174000",
    );

    expect(accounts).toEqual([source()]);
    expect(operation).toEqual({
      id: "operation-transfer-01",
      type: "internal_transfer",
      status: "completed",
      assetCode: "USD",
      amount: "25",
      direction: "outgoing",
      createdAt: updatedAt,
      completedAt: updatedAt,
      updatedAt,
    });
    expect(JSON.stringify({ accounts, operation })).not.toMatch(
      /accountCode|provider|journal|trace|secret/i,
    );
    expect(calls).toHaveLength(2);
    expect(String(calls[0]?.input)).toBe("/api/v1/wallet/accounts");
    expect((calls[0]?.init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(String(calls[1]?.input)).toBe("/api/v1/wallet/transfers");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(new Headers(calls[1]?.init?.headers).get("idempotency-key")).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      sourceAccountId: "account-source-01",
      destinationAccountId: "account-destination-02",
      assetCode: "USD",
      amount: "25",
    });
    expect(calls.every((call) => call.init?.credentials === "include")).toBe(true);
    expect(calls.every((call) => call.init?.cache === "no-store")).toBe(true);
  });

  it("replays the same canonical key and body idempotently", async () => {
    const cache = new Map<string, string>();
    const calls = installFetch((call) => {
      const headers = new Headers(call.init?.headers);
      const key = headers.get("idempotency-key") ?? "";
      const body = String(call.init?.body);
      const fingerprint = `${key}\u0000${body}`;
      const existing = cache.get(fingerprint);
      if (existing) return new Response(existing, { status: 201 });
      const serialized = JSON.stringify(operationWire());
      cache.set(fingerprint, serialized);
      return new Response(serialized, { status: 201 });
    });
    const key = "123e4567-e89b-42d3-a456-426614174000";
    const input = { destinationAccountId: "account-destination-02", amount: "25" };
    const first = await backendApi.createWalletTransfer(session(), source(), input, key);
    const replay = await backendApi.createWalletTransfer(session(), source(), input, key);

    expect(replay).toEqual(first);
    expect(cache).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0]?.init?.headers).get("idempotency-key")).toBe(key);
    expect(new Headers(calls[1]?.init?.headers).get("idempotency-key")).toBe(key);
    expect(calls[1]?.init?.body).toBe(calls[0]?.init?.body);
  });

  it("locks a pending submit and gives the next accepted submit a distinct canonical key", () => {
    const input = { destinationAccountId: "account-destination-02", amount: "25" };
    const scope = walletTransferMutationScopeKey(session(), testEnvironment(), source(), input)!;
    const gate = createWalletTransferMutationGate(scope);
    const first = beginWalletTransferMutation(
      gate,
      scope,
      source(),
      input,
      () => "123e4567-e89b-42d3-a456-426614174000",
    )!;
    expect(
      beginWalletTransferMutation(
        gate,
        scope,
        source(),
        input,
        () => "123e4567-e89b-42d3-b456-426614174001",
      ),
    ).toBeNull();
    expect(first.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("denies mismatched and expired sessions before any network request", async () => {
    const calls = installFetch(() => {
      throw new Error("fetch must not run");
    });
    await expect(
      backendApi.walletTransferAccounts(
        session({ environment: alternateEnvironment(testEnvironment()) }),
      ),
    ).rejects.toBeInstanceOf(BackendApiError);
    await expect(
      backendApi.createWalletTransfer(
        session({ expiresAt: "2020-01-01T00:00:00.000Z" }),
        source(),
        { destinationAccountId: "account-destination-02", amount: "25" },
        "123e4567-e89b-42d3-a456-426614174000",
      ),
    ).rejects.toBeInstanceOf(BackendApiError);
    expect(calls).toHaveLength(0);
  });

  it("rejects stale account and mutation success, error and finally after scope change", () => {
    const oldSession = session();
    const newSession = session({ actorId: "actor-transfer-integration-02" });
    const oldAccountScope = walletTransferAccountScopeKey(oldSession, testEnvironment())!;
    const newAccountScope = walletTransferAccountScopeKey(newSession, testEnvironment())!;
    const accountState = walletTransferAccountReducer(initialWalletTransferAccountState, {
      type: "reset",
      scopeKey: newAccountScope,
      requestKey: "account-request-new",
    });
    expect(
      walletTransferAccountReducer(accountState, {
        type: "loaded",
        requestKey: "account-request-old",
        accounts: [source()],
      }),
    ).toBe(accountState);
    expect(
      walletTransferAccountReducer(accountState, {
        type: "failed",
        requestKey: "account-request-old",
      }),
    ).toBe(accountState);
    expect(
      walletTransferAccountReducer(accountState, {
        type: "settled",
        requestKey: "account-request-old",
      }),
    ).toBe(accountState);
    expect(oldAccountScope).not.toBe(newAccountScope);

    const input = { destinationAccountId: "account-destination-02", amount: "25" };
    const oldMutationScope = walletTransferMutationScopeKey(
      oldSession,
      testEnvironment(),
      source(),
      input,
    )!;
    const newMutationScope = walletTransferMutationScopeKey(
      newSession,
      testEnvironment(),
      source(),
      input,
    )!;
    const gate = createWalletTransferMutationGate(oldMutationScope);
    const ticket = beginWalletTransferMutation(
      gate,
      oldMutationScope,
      source(),
      input,
      () => "123e4567-e89b-42d3-a456-426614174000",
    )!;
    syncWalletTransferMutationScope(gate, newMutationScope);
    const mutationState = walletTransferMutationReducer(initialWalletTransferMutationState, {
      type: "reset",
      scopeKey: newMutationScope,
    });
    expect(
      walletTransferMutationReducer(mutationState, {
        type: "succeeded",
        requestKey: ticket.requestKey,
        operation: {
          id: "operation-transfer-01",
          type: "internal_transfer",
          status: "completed",
          assetCode: "USD",
          amount: "25",
          direction: "outgoing",
          createdAt: updatedAt,
          completedAt: updatedAt,
          updatedAt,
        },
      }),
    ).toBe(mutationState);
    expect(
      walletTransferMutationReducer(mutationState, {
        type: "failed",
        requestKey: ticket.requestKey,
        message: "stale",
      }),
    ).toBe(mutationState);
    expect(
      walletTransferMutationReducer(mutationState, {
        type: "settled",
        requestKey: ticket.requestKey,
      }),
    ).toBe(mutationState);
  });
});
