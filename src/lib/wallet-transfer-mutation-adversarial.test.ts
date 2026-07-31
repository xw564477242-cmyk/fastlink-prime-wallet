import { describe, expect, it } from "bun:test";
import {
  WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES,
  WALLET_TRANSFER_ACCOUNT_MAX_ITEMS,
  WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES,
  buildWalletTransferRequest,
  normalizeWalletTransferAccount,
  normalizeWalletTransferAccountsResponse,
  normalizeWalletTransferInput,
  normalizeWalletTransferResponse,
  walletTransferSessionAllowed,
  type BackendSession,
  type WalletOperationActivity,
  type WalletTransferAccount,
} from "./backend-api";
import {
  acceptsWalletTransferMutationCompletion,
  beginWalletTransferMutation,
  createWalletTransferMutationGate,
  initialWalletTransferMutationState,
  settleWalletTransferMutation,
  syncWalletTransferMutationScope,
  walletTransferMutationReducer,
  walletTransferMutationScopeKey,
  walletTransferMutationView,
} from "./wallet-transfer-mutation-state";

const now = "2026-07-31T15:30:00.000Z";

function backendAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-source-01",
    accountCode: "CUSTOMER:SOURCE:USD",
    name: "Source Wallet",
    assetCode: "USD",
    status: "ACTIVE",
    currentBalance: "100.5",
    postedBalance: "100.5",
    pendingBalance: "0",
    availableBalance: "100.5",
    updatedAt: now,
    ...overrides,
  };
}

function source(overrides: Partial<WalletTransferAccount> = {}): WalletTransferAccount {
  return {
    id: "account-source-01",
    assetCode: "USD",
    status: "active",
    currentBalance: "100.5",
    postedBalance: "100.5",
    pendingBalance: "0",
    availableBalance: "100.5",
    updatedAt: now,
    ...overrides,
  };
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-01",
    expiresAt: "2099-08-01T08:00:00.000Z",
    tenantId: "tenant-01",
    customerId: "customer-01",
    environment: "SANDBOX",
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "operation-transfer-01",
    type: "INTERNAL_TRANSFER",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25",
    direction: "OUTGOING",
    createdAt: now,
    completedAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("Internal Wallet transfer account and input contract", () => {
  it("rejects hostile objects before reflection and bounds the raw account list", () => {
    expect(WALLET_TRANSFER_ACCOUNT_MAX_ITEMS).toBe(100);
    expect(WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES).toBe(65_536);
    const traps = { get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
    const proxy = new Proxy([backendAccount()], {
      get() {
        traps.get += 1;
        throw new Error("get trap must not run");
      },
      getPrototypeOf() {
        traps.getPrototypeOf += 1;
        throw new Error("prototype trap must not run");
      },
      ownKeys() {
        traps.ownKeys += 1;
        throw new Error("ownKeys trap must not run");
      },
      getOwnPropertyDescriptor() {
        traps.getOwnPropertyDescriptor += 1;
        throw new Error("descriptor trap must not run");
      },
    });
    expect(() => normalizeWalletTransferAccountsResponse(proxy as unknown as string)).toThrow();
    expect(traps).toEqual({ get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 });
    expect(() => normalizeWalletTransferAccountsResponse("not-json")).toThrow();
    expect(() =>
      normalizeWalletTransferAccountsResponse(
        " ".repeat(WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES + 1),
      ),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferAccountsResponse(
        JSON.stringify(
          Array.from({ length: WALLET_TRANSFER_ACCOUNT_MAX_ITEMS + 1 }, (_, index) =>
            backendAccount({ id: `account-${index}` }),
          ),
        ),
      ),
    ).toThrow();
  });

  it("accepts only ordinary own-data account records and exposes the public allowlist", () => {
    const parsed = normalizeWalletTransferAccount(backendAccount());
    expect(parsed).toEqual(source());
    expect(Object.keys(parsed).sort()).toEqual([
      "assetCode",
      "availableBalance",
      "currentBalance",
      "id",
      "pendingBalance",
      "postedBalance",
      "status",
      "updatedAt",
    ]);
    expect(() => normalizeWalletTransferAccount(Object.create(null))).toThrow();
    expect(() => normalizeWalletTransferAccount([])).toThrow();
    expect(() =>
      normalizeWalletTransferAccount({ ...backendAccount(), status: "active" }),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferAccount({ ...backendAccount(), provider: "must-not-render" }),
    ).toThrow();
  });

  it("executes zero required or unknown getters and rejects inconsistent balances", () => {
    let reads = 0;
    const required = backendAccount();
    Object.defineProperty(required, "availableBalance", {
      enumerable: true,
      get() {
        reads += 1;
        return "100.5";
      },
    });
    expect(() => normalizeWalletTransferAccount(required)).toThrow();
    expect(reads).toBe(0);

    const unknown = backendAccount();
    Object.defineProperty(unknown, "provider", {
      enumerable: true,
      get() {
        reads += 1;
        return "secret";
      },
    });
    expect(() => normalizeWalletTransferAccount(unknown)).toThrow();
    expect(reads).toBe(0);
    expect(() =>
      normalizeWalletTransferAccount(backendAccount({ currentBalance: "101" })),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferAccount(backendAccount({ availableBalance: "99" })),
    ).toThrow();
  });

  it("rejects sparse, accessor and duplicate account arrays", () => {
    expect(normalizeWalletTransferAccountsResponse(JSON.stringify([backendAccount()]))).toEqual([
      source(),
    ]);
    const sparse = new Array(1);
    expect(() => normalizeWalletTransferAccountsResponse(sparse as unknown as string)).toThrow();
    const accessor = [backendAccount()];
    let reads = 0;
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        reads += 1;
        return backendAccount();
      },
    });
    expect(() => normalizeWalletTransferAccountsResponse(accessor as unknown as string)).toThrow();
    expect(reads).toBe(0);
    expect(() =>
      normalizeWalletTransferAccountsResponse(JSON.stringify([backendAccount(), backendAccount()])),
    ).toThrow();
  });

  it("normalizes exact decimal input without float conversion and enforces available balance", () => {
    expect(
      normalizeWalletTransferInput(
        { destinationAccountId: "account-destination-02", amount: "25.0000" },
        source(),
      ),
    ).toEqual({ destinationAccountId: "account-destination-02", amount: "25" });
    expect(
      normalizeWalletTransferInput(
        { destinationAccountId: "account-destination-02", amount: "100.500000000000000000" },
        source(),
      ).amount,
    ).toBe("100.5");
    for (const amount of [
      "0",
      "0.0",
      "-1",
      "+1",
      "01",
      "1e2",
      "1.",
      ".1",
      "100.500000000000000001",
    ]) {
      expect(() =>
        normalizeWalletTransferInput(
          { destinationAccountId: "account-destination-02", amount },
          source(),
        ),
      ).toThrow();
    }
    expect(() =>
      normalizeWalletTransferInput({ destinationAccountId: source().id, amount: "1" }, source()),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferInput(
        { destinationAccountId: "account-destination-02", amount: "1", recipient: "invented" },
        source(),
      ),
    ).toThrow();
    expect(() =>
      normalizeWalletTransferInput(
        { destinationAccountId: "account-destination-02", amount: "1" },
        source({ status: "frozen" }),
      ),
    ).toThrow();
  });

  it("never executes input getters", () => {
    let reads = 0;
    const input = { destinationAccountId: "account-destination-02" } as Record<string, unknown>;
    Object.defineProperty(input, "amount", {
      enumerable: true,
      get() {
        reads += 1;
        return "1";
      },
    });
    expect(() => normalizeWalletTransferInput(input, source())).toThrow();
    expect(reads).toBe(0);
  });
});

describe("Internal Wallet transfer request and response contract", () => {
  it("bounds the raw transfer response before parsing", () => {
    expect(WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES).toBe(16_384);
    expect(() =>
      normalizeWalletTransferResponse(
        " ".repeat(WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES + 1),
        source(),
        { destinationAccountId: "account-destination-02", amount: "25" },
      ),
    ).toThrow();
  });

  it("builds the exact POST path, body and canonical UUIDv4 Idempotency-Key", () => {
    const request = buildWalletTransferRequest(
      source(),
      { destinationAccountId: "account-destination-02", amount: "25.00" },
      "123e4567-e89b-42d3-a456-426614174000",
    );
    expect(request.path).toBe("/v1/wallet/transfers");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({
      "Idempotency-Key": "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(JSON.parse(String(request.init.body))).toEqual({
      sourceAccountId: "account-source-01",
      destinationAccountId: "account-destination-02",
      assetCode: "USD",
      amount: "25",
    });
    expect(Object.keys(JSON.parse(String(request.init.body))).sort()).toEqual([
      "amount",
      "assetCode",
      "destinationAccountId",
      "sourceAccountId",
    ]);
  });

  it("accepts only bounded raw JSON and reflects no Provider or journal fields", () => {
    const operation = normalizeWalletTransferResponse(response(), source(), {
      destinationAccountId: "account-destination-02",
      amount: "25",
    });
    expect(operation).toEqual({
      id: "operation-transfer-01",
      type: "internal_transfer",
      status: "completed",
      assetCode: "USD",
      amount: "25",
      direction: "outgoing",
      createdAt: now,
      completedAt: now,
      updatedAt: now,
    });
    expect(JSON.stringify(operation)).not.toMatch(/provider|journal|trace|secret/i);
    expect(() =>
      normalizeWalletTransferResponse(
        JSON.stringify({ ...JSON.parse(response()), providerReference: "provider-secret" }),
        source(),
        { destinationAccountId: "account-destination-02", amount: "25" },
      ),
    ).toThrow();
  });

  it("binds the response to type, asset, amount and source-relative direction", () => {
    const expectation = { destinationAccountId: "account-destination-02", amount: "25" };
    expect(
      normalizeWalletTransferResponse(
        response({ direction: "BETWEEN_OWN_ACCOUNTS" }),
        source(),
        expectation,
      ).direction,
    ).toBe("between_own_accounts");
    for (const overrides of [
      { type: "DEPOSIT" },
      { assetCode: "EUR" },
      { amount: "24.999999999999999999" },
      { direction: "INCOMING" },
      { completedAt: "not-a-time" },
    ]) {
      expect(() =>
        normalizeWalletTransferResponse(response(overrides), source(), expectation),
      ).toThrow();
    }
  });
});

describe("Internal Wallet transfer scope, duplicate and stale completion isolation", () => {
  const input = { destinationAccountId: "account-destination-02", amount: "25" };

  it("allows only matching SANDBOX/TEST identity, runtime and an active exact source balance", () => {
    expect(walletTransferSessionAllowed(session(), "SANDBOX")).toBe(true);
    expect(walletTransferMutationScopeKey(session(), "SANDBOX", source(), input)).not.toBeNull();
    expect(
      walletTransferMutationScopeKey(session({ environment: "TEST" }), "TEST", source(), input),
    ).not.toBeNull();
    expect(walletTransferMutationScopeKey(session(), "TEST", source(), input)).toBeNull();
    expect(walletTransferMutationScopeKey(session(), "PRODUCTION", source(), input)).toBeNull();
    expect(
      walletTransferMutationScopeKey(
        session({ expiresAt: "2020-01-01T00:00:00.000Z" }),
        "SANDBOX",
        source(),
        input,
      ),
    ).toBeNull();
    expect(
      walletTransferMutationScopeKey(session(), "SANDBOX", source({ status: "frozen" }), input),
    ).toBeNull();
    expect(
      walletTransferMutationScopeKey(session(), "SANDBOX", source(), { ...input, amount: "101" }),
    ).toBeNull();
  });

  it("changes scope for identity, environment, every source version field, target and amount", () => {
    const original = walletTransferMutationScopeKey(session(), "SANDBOX", source(), input);
    expect(original).not.toBeNull();
    const variants: Array<[BackendSession, "SANDBOX" | "TEST", WalletTransferAccount, unknown]> = [
      [session({ actorId: "actor-02" }), "SANDBOX", source(), input],
      [session({ expiresAt: "2099-08-01T09:00:00.000Z" }), "SANDBOX", source(), input],
      [session({ tenantId: "tenant-02" }), "SANDBOX", source(), input],
      [session({ customerId: "customer-02" }), "SANDBOX", source(), input],
      [session({ environment: "TEST" }), "TEST", source(), input],
      [session(), "SANDBOX", source({ id: "account-source-02" }), input],
      [session(), "SANDBOX", source({ assetCode: "EUR" }), input],
      [session(), "SANDBOX", source({ currentBalance: "101.5", pendingBalance: "1" }), input],
      [
        session(),
        "SANDBOX",
        source({ postedBalance: "99.5", availableBalance: "99.5", currentBalance: "99.5" }),
        input,
      ],
      [session(), "SANDBOX", source({ updatedAt: "2026-07-31T15:31:00.000Z" }), input],
      [
        session(),
        "SANDBOX",
        source(),
        { ...input, destinationAccountId: "account-destination-03" },
      ],
      [session(), "SANDBOX", source(), { ...input, amount: "26" }],
    ];
    for (const args of variants) {
      expect(walletTransferMutationScopeKey(...args)).not.toBe(original);
    }
  });

  it("synchronously locks duplicates and gives each accepted submit one unique UUIDv4", () => {
    const scope = walletTransferMutationScopeKey(session(), "SANDBOX", source(), input)!;
    const gate = createWalletTransferMutationGate(scope);
    const keys = ["123e4567-e89b-42d3-a456-426614174000", "123e4567-e89b-42d3-b456-426614174001"];
    const first = beginWalletTransferMutation(gate, scope, source(), input, () => keys[0])!;
    expect(beginWalletTransferMutation(gate, scope, source(), input, () => keys[1])).toBeNull();
    expect(settleWalletTransferMutation(gate, first, scope)).toBe(true);
    const second = beginWalletTransferMutation(gate, scope, source(), input, () => keys[1])!;
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(second.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("allows stale success, error and finally zero writes after scope or balance changes", () => {
    const originalScope = walletTransferMutationScopeKey(session(), "SANDBOX", source(), input)!;
    const changedScope = walletTransferMutationScopeKey(
      session(),
      "SANDBOX",
      source({ currentBalance: "75.5", postedBalance: "75.5", availableBalance: "75.5" }),
      input,
    )!;
    const gate = createWalletTransferMutationGate(originalScope);
    const ticket = beginWalletTransferMutation(
      gate,
      originalScope,
      source(),
      input,
      () => "123e4567-e89b-42d3-a456-426614174000",
    )!;
    let state = walletTransferMutationReducer(initialWalletTransferMutationState, {
      type: "started",
      scopeKey: originalScope,
      requestKey: ticket.requestKey,
    });
    syncWalletTransferMutationScope(gate, changedScope);
    state = walletTransferMutationReducer(state, { type: "reset", scopeKey: changedScope });
    const operation = normalizeWalletTransferResponse(response(), source(), input);
    expect(acceptsWalletTransferMutationCompletion(gate, ticket, changedScope)).toBe(false);
    expect(settleWalletTransferMutation(gate, ticket, changedScope)).toBe(false);
    expect(
      walletTransferMutationReducer(state, {
        type: "succeeded",
        requestKey: ticket.requestKey,
        operation,
      }),
    ).toEqual(state);
    expect(
      walletTransferMutationReducer(state, {
        type: "failed",
        requestKey: ticket.requestKey,
        message: "unsafe",
      }),
    ).toEqual(state);
    expect(
      walletTransferMutationReducer(state, {
        type: "settled",
        requestKey: ticket.requestKey,
      }),
    ).toEqual(state);
    expect(walletTransferMutationView(state, changedScope).operation).toBeNull();
  });

  it("accepts only the current request generation", () => {
    const scope = walletTransferMutationScopeKey(session(), "SANDBOX", source(), input)!;
    const gate = createWalletTransferMutationGate(scope);
    const first = beginWalletTransferMutation(
      gate,
      scope,
      source(),
      input,
      () => "123e4567-e89b-42d3-a456-426614174000",
    )!;
    expect(settleWalletTransferMutation(gate, first, scope)).toBe(true);
    const second = beginWalletTransferMutation(
      gate,
      scope,
      source(),
      input,
      () => "123e4567-e89b-42d3-b456-426614174001",
    )!;
    expect(acceptsWalletTransferMutationCompletion(gate, first, scope)).toBe(false);
    expect(acceptsWalletTransferMutationCompletion(gate, second, scope)).toBe(true);
  });
});
