import { describe, expect, it } from "bun:test";
import {
  buildWalletOperationDetailPath,
  normalizeWalletTransferStatusExpectation,
  normalizeWalletTransferStatusResponse,
  type BackendSession,
  type WalletOperationActivity,
} from "./backend-api";
import {
  acceptsWalletTransferStatusRefreshCompletion,
  beginWalletTransferStatusRefresh,
  createWalletTransferStatusRefreshGate,
  initialWalletTransferStatusRefreshState,
  settleWalletTransferStatusRefresh,
  syncWalletTransferStatusRefreshScope,
  walletTransferStatusRefreshReducer,
  walletTransferStatusRefreshScopeKey,
  walletTransferStatusRefreshView,
  type WalletTransferReceiptContext,
} from "./wallet-transfer-status-refresh-state";

const createdAt = "2026-07-31T15:30:00.000Z";
const later = "2026-07-31T15:31:00.000Z";

function operation(overrides: Partial<WalletOperationActivity> = {}): WalletOperationActivity {
  return {
    id: "operation-transfer-01",
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

function response(overrides: Record<string, unknown> = {}) {
  return {
    id: "operation-transfer-01",
    type: "INTERNAL_TRANSFER",
    status: "PROCESSING",
    assetCode: "USD",
    amount: "25",
    direction: "OUTGOING",
    createdAt,
    completedAt: null,
    updatedAt: createdAt,
    ...overrides,
  };
}

function wireResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(response(overrides));
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-01",
    tenantId: "tenant-01",
    customerId: "customer-01",
    environment: "SANDBOX",
    expiresAt: "2099-08-01T08:00:00.000Z",
    ...overrides,
  };
}

function receipt(
  overrides: Partial<WalletTransferReceiptContext> = {},
): WalletTransferReceiptContext {
  return {
    sourceAccountId: "account-source-01",
    destinationAccountId: "account-destination-02",
    amount: "25",
    transferRequestKey: "transfer-request-generation-1",
    transferGeneration: 1,
    operation: operation(),
    ...overrides,
  };
}

describe("Wallet transfer status exact public response", () => {
  it("uses only the existing immutable operation detail GET path", () => {
    expect(buildWalletOperationDetailPath("operation-transfer-01")).toBe(
      "/v1/wallet/operations/operation-transfer-01",
    );
    expect(() => buildWalletOperationDetailPath("unsafe/path")).toThrow();
  });

  it("accepts exactly nine ordinary own data fields", () => {
    const refreshed = normalizeWalletTransferStatusResponse(wireResponse(), {
      previous: operation(),
    });
    expect(refreshed).toEqual(operation());
    expect(Object.keys(refreshed).sort()).toEqual([
      "amount",
      "assetCode",
      "completedAt",
      "createdAt",
      "direction",
      "id",
      "status",
      "type",
      "updatedAt",
    ]);
  });

  it("rejects inherited, accessor, unknown and symbol fields without reading getters", () => {
    let reads = 0;
    const inherited = Object.create(response());
    expect(() =>
      normalizeWalletTransferStatusResponse(inherited, { previous: operation() }),
    ).toThrow();

    const accessor = response();
    Object.defineProperty(accessor, "status", {
      enumerable: true,
      get() {
        reads += 1;
        return "PROCESSING";
      },
    });
    expect(() =>
      normalizeWalletTransferStatusResponse(accessor, { previous: operation() }),
    ).toThrow();
    expect(reads).toBe(0);

    const unknownAccessor = response();
    Object.defineProperty(unknownAccessor, "provider", {
      enumerable: true,
      get() {
        reads += 1;
        return "secret";
      },
    });
    expect(() =>
      normalizeWalletTransferStatusResponse(unknownAccessor, { previous: operation() }),
    ).toThrow();
    expect(reads).toBe(0);
    expect(() =>
      normalizeWalletTransferStatusResponse(wireResponse({ providerReference: "secret" }), {
        previous: operation(),
      }),
    ).toThrow();
    expect(() => {
      const value = response() as Record<PropertyKey, unknown>;
      value[Symbol("unknown")] = "secret";
      normalizeWalletTransferStatusResponse(value, { previous: operation() });
    }).toThrow();
  });

  it("rejects Proxy containers without executing property get traps", () => {
    let reads = 0;
    const proxy = new Proxy(response(), {
      get(target, property, receiver) {
        reads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => normalizeWalletTransferStatusResponse(proxy, { previous: operation() })).toThrow();
    expect(reads).toBe(0);
  });

  it("rejects hostile reflective Proxies before executing any reflection trap", () => {
    let getPrototypeOfCalls = 0;
    const getPrototypeOfProxy = new Proxy(response(), {
      getPrototypeOf() {
        getPrototypeOfCalls += 1;
        throw new Error("must not execute getPrototypeOf trap");
      },
    });
    expect(() =>
      normalizeWalletTransferStatusResponse(getPrototypeOfProxy, { previous: operation() }),
    ).toThrow();
    expect(getPrototypeOfCalls).toBe(0);

    let ownKeysCalls = 0;
    const ownKeysProxy = new Proxy(response(), {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("must not execute ownKeys trap");
      },
    });
    expect(() =>
      normalizeWalletTransferStatusResponse(ownKeysProxy, { previous: operation() }),
    ).toThrow();
    expect(ownKeysCalls).toBe(0);

    let getOwnPropertyDescriptorCalls = 0;
    const getOwnPropertyDescriptorProxy = new Proxy(response(), {
      getOwnPropertyDescriptor() {
        getOwnPropertyDescriptorCalls += 1;
        throw new Error("must not execute getOwnPropertyDescriptor trap");
      },
    });
    expect(() =>
      normalizeWalletTransferStatusResponse(getOwnPropertyDescriptorProxy, {
        previous: operation(),
      }),
    ).toThrow();
    expect(getOwnPropertyDescriptorCalls).toBe(0);
  });

  it("binds immutable id, type, asset, amount, direction and createdAt", () => {
    const variants = [
      { id: "operation-transfer-02" },
      { type: "DEPOSIT" },
      { assetCode: "EUR" },
      { amount: "24.999" },
      { direction: "INCOMING" },
      { createdAt: "2026-07-31T15:29:00.000Z" },
    ];
    for (const variant of variants) {
      expect(() =>
        normalizeWalletTransferStatusResponse(wireResponse(variant), { previous: operation() }),
      ).toThrow();
    }
  });
});

describe("Wallet transfer finite forward-only status transitions", () => {
  it("allows only forward or equal processing transitions", () => {
    const cases: Array<[Record<string, unknown>, WalletOperationActivity["status"]]> = [
      [{ status: "PROCESSING" }, "processing"],
      [{ status: "PENDING_SETTLEMENT", updatedAt: later }, "pending_settlement"],
      [{ status: "COMPLETED", completedAt: later, updatedAt: later }, "completed"],
      [{ status: "FAILED", updatedAt: later }, "failed"],
    ];
    for (const [value, status] of cases) {
      expect(
        normalizeWalletTransferStatusResponse(wireResponse(value), { previous: operation() })
          .status,
      ).toBe(status);
    }
  });

  it("never permits a terminal or pending status to move backwards", () => {
    const completed = operation({ status: "completed", completedAt: later, updatedAt: later });
    expect(
      normalizeWalletTransferStatusResponse(
        wireResponse({ status: "COMPLETED", completedAt: later, updatedAt: later }),
        { previous: completed },
      ).status,
    ).toBe("completed");
    expect(() =>
      normalizeWalletTransferStatusResponse(
        wireResponse({ status: "FAILED", completedAt: later, updatedAt: later }),
        { previous: completed },
      ),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferStatusResponse(wireResponse({ status: "PROCESSING" }), {
        previous: operation({ status: "pending_settlement" }),
      }),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferStatusResponse(
        wireResponse({ status: "COMPLETED", completedAt: later, updatedAt: later }),
        { previous: operation({ status: "failed" }) },
      ),
    ).toThrow();
  });

  it("rejects timestamp rollback and invalid completion timing", () => {
    const previous = operation({ updatedAt: later });
    expect(() => normalizeWalletTransferStatusResponse(wireResponse(), { previous })).toThrow();
    expect(() =>
      normalizeWalletTransferStatusResponse(
        wireResponse({ status: "COMPLETED", completedAt: null, updatedAt: later }),
        { previous: operation() },
      ),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferStatusResponse(
        wireResponse({ status: "PROCESSING", completedAt: later, updatedAt: later }),
        { previous: operation() },
      ),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferStatusExpectation({
        previous: operation({ status: "completed", completedAt: null }),
      }),
    ).toThrow();
  });
});

describe("Wallet transfer status scope and manual request isolation", () => {
  it("allows only matching SANDBOX/TEST authenticated scope", () => {
    expect(walletTransferStatusRefreshScopeKey(session(), "SANDBOX", receipt())).not.toBeNull();
    expect(
      walletTransferStatusRefreshScopeKey(session({ environment: "TEST" }), "TEST", receipt()),
    ).not.toBeNull();
    expect(walletTransferStatusRefreshScopeKey(session(), "TEST", receipt())).toBeNull();
    expect(walletTransferStatusRefreshScopeKey(session(), "PRODUCTION", receipt())).toBeNull();
    expect(
      walletTransferStatusRefreshScopeKey(
        session({ expiresAt: "2020-08-01T08:00:00.000Z" }),
        "SANDBOX",
        receipt(),
      ),
    ).toBeNull();
    expect(walletTransferStatusRefreshScopeKey(null, "SANDBOX", receipt())).toBeNull();
  });

  it("binds identity, environment, transfer input, mutation generation and all operation versions", () => {
    const original = walletTransferStatusRefreshScopeKey(session(), "SANDBOX", receipt());
    expect(original).not.toBeNull();
    const variants: Array<[BackendSession, "SANDBOX" | "TEST", WalletTransferReceiptContext]> = [
      [session({ actorId: "actor-02" }), "SANDBOX", receipt()],
      [session({ expiresAt: "2099-08-01T08:01:00.000Z" }), "SANDBOX", receipt()],
      [session({ tenantId: "tenant-02" }), "SANDBOX", receipt()],
      [session({ customerId: "customer-02" }), "SANDBOX", receipt()],
      [session({ environment: "TEST" }), "TEST", receipt()],
      [session(), "SANDBOX", receipt({ sourceAccountId: "account-source-02" })],
      [session(), "SANDBOX", receipt({ destinationAccountId: "account-destination-03" })],
      [session(), "SANDBOX", receipt({ amount: "26", operation: operation({ amount: "26" }) })],
      [session(), "SANDBOX", receipt({ transferRequestKey: "transfer-request-generation-2" })],
      [session(), "SANDBOX", receipt({ transferGeneration: 2 })],
      [session(), "SANDBOX", receipt({ operation: operation({ id: "operation-transfer-02" }) })],
      [session(), "SANDBOX", receipt({ operation: operation({ status: "pending_settlement" }) })],
      [session(), "SANDBOX", receipt({ operation: operation({ updatedAt: later }) })],
    ];
    for (const variant of variants) {
      expect(walletTransferStatusRefreshScopeKey(...variant)).not.toBe(original);
    }
    expect(walletTransferStatusRefreshScopeKey(session(), "SANDBOX", receipt(), 1)).not.toBe(
      original,
    );
  });

  it("starts only on an explicit begin, locks duplicate refreshes and increments generations", () => {
    const scope = walletTransferStatusRefreshScopeKey(session(), "SANDBOX", receipt())!;
    const gate = createWalletTransferStatusRefreshGate(scope);
    expect(gate.activeRequestKey).toBeNull();
    const first = beginWalletTransferStatusRefresh(gate, scope)!;
    expect(beginWalletTransferStatusRefresh(gate, scope)).toBeNull();
    expect(settleWalletTransferStatusRefresh(gate, first, scope)).toBe(true);
    const second = beginWalletTransferStatusRefresh(gate, scope)!;
    expect(second.generation).toBeGreaterThan(first.generation);
    expect(second.requestKey).not.toBe(first.requestKey);
  });

  it("allows stale response, error and finally zero writes after any scope change", () => {
    const scope = walletTransferStatusRefreshScopeKey(session(), "SANDBOX", receipt())!;
    const changed = walletTransferStatusRefreshScopeKey(
      session(),
      "SANDBOX",
      receipt({ destinationAccountId: "account-destination-03" }),
    )!;
    const gate = createWalletTransferStatusRefreshGate(scope);
    const ticket = beginWalletTransferStatusRefresh(gate, scope)!;
    let state = walletTransferStatusRefreshReducer(initialWalletTransferStatusRefreshState, {
      type: "started",
      scopeKey: scope,
      requestKey: ticket.requestKey,
    });
    syncWalletTransferStatusRefreshScope(gate, changed);
    state = walletTransferStatusRefreshReducer(state, { type: "reset", scopeKey: changed });
    expect(acceptsWalletTransferStatusRefreshCompletion(gate, ticket, changed)).toBe(false);
    expect(settleWalletTransferStatusRefresh(gate, ticket, changed)).toBe(false);
    for (const action of [
      { type: "loaded" as const, requestKey: ticket.requestKey, operation: operation() },
      { type: "failed" as const, requestKey: ticket.requestKey, message: "unsafe" },
      { type: "settled" as const, requestKey: ticket.requestKey },
    ]) {
      expect(walletTransferStatusRefreshReducer(state, action)).toEqual(state);
    }
    expect(walletTransferStatusRefreshView(state, changed).operation).toBeNull();
  });
});
