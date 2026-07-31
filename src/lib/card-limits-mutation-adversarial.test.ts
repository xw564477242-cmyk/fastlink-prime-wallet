import { describe, expect, it } from "bun:test";
import {
  CARD_LIMIT_UPDATE_MAX_MINOR,
  buildCardLimitsUpdateRequest,
  normalizeCardLimitsUpdateInput,
  normalizeCardLimitsUpdateResponse,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
  type WalletCardLimits,
} from "./backend-api";
import {
  acceptsCardLimitsMutationCompletion,
  beginCardLimitsMutation,
  cardLimitsMutationReducer,
  cardLimitsMutationScopeKey,
  cardLimitsMutationView,
  createCardLimitsMutationGate,
  initialCardLimitsMutationState,
  settleCardLimitsMutation,
  syncCardLimitsMutationScope,
} from "./card-limits-mutation-state";
import { cardLimitsReducer, initialCardLimitsState } from "./card-limits-state";

const keys = ["a7777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "b8888888-bbbb-4bbb-9bbb-bbbbbbbbbbbb"];

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-a",
  tenantId: "tenant-a",
  customerId: "customer-a",
  environment: "SANDBOX",
  ...overrides,
});

const card = (overrides: Partial<WalletCard> = {}): WalletCard => ({
  cardId: "card:owned.1",
  type: "virtual",
  status: "active",
  last4: "4242",
  expiry: "12/30",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Primary Card",
  balance: 25,
  availableBalanceMinor: "2500",
  createdAt: "2026-01-01T00:00:00Z",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: true,
    updateLimits: true,
  },
  ...overrides,
});

const limits = (overrides: Partial<WalletCardLimits> = {}): WalletCardLimits => ({
  cardId: "card:owned.1",
  singleTransactionMinor: "10000",
  dailySpendMinor: "50000",
  monthlySpendMinor: "500000",
  dailyAtmMinor: "20000",
  updatedAt: "2026-07-31T10:00:00Z",
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  cardId: "card:owned.1",
  singleTransactionMinor: "12000",
  dailySpendMinor: "60000",
  monthlySpendMinor: "600000",
  dailyAtmMinor: "25000",
  updatedAt: "2026-07-31T14:00:00.123456789+08:00",
  ...overrides,
});

const fullInput = {
  singleTransactionMinor: 12000,
  dailySpendMinor: 60000,
  monthlySpendMinor: 600000,
  dailyAtmMinor: 25000,
};

describe("Selected Card limits mutation contract and request gate", () => {
  it("allows only an exact SANDBOX/TEST session, selected Card and updateLimits capability", () => {
    expect(cardLimitsMutationScopeKey(session(), "SANDBOX", card(), limits())).not.toBeNull();
    expect(
      cardLimitsMutationScopeKey(
        session({ environment: "TEST" }),
        "TEST",
        card({ type: "physical", status: "frozen" }),
        limits(),
      ),
    ).not.toBeNull();
    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(
        cardLimitsMutationScopeKey(session({ environment }), environment, card(), limits()),
      ).toBeNull();
    }
    expect(cardLimitsMutationScopeKey(session(), "TEST", card(), limits())).toBeNull();
    expect(
      cardLimitsMutationScopeKey(
        session(),
        "SANDBOX",
        card({ capabilities: { ...card().capabilities, updateLimits: false } }),
        limits(),
      ),
    ).toBeNull();
    for (const mutation of [
      { status: "closed" as const },
      { status: "failed" as const },
      { type: "travel" as const },
      { last4: "123" },
      { currency: "usd" },
      { availableBalanceMinor: "01" },
    ]) {
      expect(cardLimitsMutationScopeKey(session(), "SANDBOX", card(mutation), limits())).toBeNull();
    }
    expect(
      cardLimitsMutationScopeKey(session(), "SANDBOX", card(), limits({ cardId: "card:other.1" })),
    ).toBeNull();
  });

  it("accepts only the four existing optional integer fields and never executes input getters", () => {
    expect(normalizeCardLimitsUpdateInput(fullInput, limits())).toEqual(fullInput);
    expect(
      normalizeCardLimitsUpdateInput(
        { dailySpendMinor: 0 },
        limits({ singleTransactionMinor: null }),
      ),
    ).toEqual({ dailySpendMinor: 0 });
    expect(
      normalizeCardLimitsUpdateInput(
        { monthlySpendMinor: CARD_LIMIT_UPDATE_MAX_MINOR },
        limits({ dailySpendMinor: "50000", monthlySpendMinor: null }),
      ),
    ).toEqual({ monthlySpendMinor: CARD_LIMIT_UPDATE_MAX_MINOR });

    for (const value of [null, undefined, true, 1, "limits", [], new Date(), Object.create(null)]) {
      expect(() => normalizeCardLimitsUpdateInput(value, limits())).toThrow();
    }
    for (const invalid of [
      {},
      { dailySpendMinor: -1 },
      { dailySpendMinor: 1.5 },
      { dailySpendMinor: CARD_LIMIT_UPDATE_MAX_MINOR + 1 },
      { dailySpendMinor: "50000" },
      { dailySpendMinor: Number.NaN },
      { dailySpendMinor: Number.POSITIVE_INFINITY },
      { currency: "EUR" },
      { frequency: "DAILY" },
    ]) {
      expect(() => normalizeCardLimitsUpdateInput(invalid, limits())).toThrow();
    }
    expect(() =>
      normalizeCardLimitsUpdateInput(
        { dailySpendMinor: 50000 },
        limits({ monthlySpendMinor: "01" }),
      ),
    ).toThrow();

    let executions = 0;
    const required = {};
    Object.defineProperty(required, "dailySpendMinor", {
      enumerable: true,
      get() {
        executions += 1;
        return 50000;
      },
    });
    expect(() => normalizeCardLimitsUpdateInput(required, limits())).toThrow();
    expect(executions).toBe(0);
    const unknown = { dailySpendMinor: 50000 };
    Object.defineProperty(unknown, "providerLimitRef", {
      enumerable: true,
      get() {
        executions += 1;
        throw new Error("provider getter executed");
      },
    });
    expect(() => normalizeCardLimitsUpdateInput(unknown, limits())).toThrow();
    expect(executions).toBe(0);
  });

  it("enforces the Backend relationship rules against the current merged values", () => {
    expect(() =>
      normalizeCardLimitsUpdateInput({ singleTransactionMinor: 60000 }, limits()),
    ).toThrow();
    expect(() => normalizeCardLimitsUpdateInput({ dailySpendMinor: 600000 }, limits())).toThrow();
    expect(() =>
      normalizeCardLimitsUpdateInput(
        { singleTransactionMinor: 60000, dailySpendMinor: 60000, monthlySpendMinor: 60000 },
        limits(),
      ),
    ).not.toThrow();
    expect(() =>
      normalizeCardLimitsUpdateInput(
        { dailySpendMinor: 600000, monthlySpendMinor: 600000 },
        limits(),
      ),
    ).not.toThrow();
  });

  it("builds the exact POST path, body and Idempotency-Key without invented fields", () => {
    const request = buildCardLimitsUpdateRequest(card(), limits(), fullInput, keys[0]!);
    const headers = new Headers(request.init.headers);
    expect(request.path).toBe("/v1/cards/card%3Aowned.1/limits");
    expect(request.init.method).toBe("POST");
    expect(headers.get("Idempotency-Key")).toBe(keys[0]);
    expect(request.init.body).toBe(JSON.stringify(fullInput));
    expect(Object.keys(JSON.parse(String(request.init.body))).sort()).toEqual(
      Object.keys(fullInput).sort(),
    );
    expect(Object.keys(request.init).sort()).toEqual(["body", "headers", "method"]);
  });

  it("synchronously locks duplicates and issues one fresh canonical UUIDv4 per accepted submit", () => {
    const scopeKey = cardLimitsMutationScopeKey(session(), "SANDBOX", card(), limits());
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardLimitsMutationGate(scopeKey);
    let keyIndex = 0;
    const first = beginCardLimitsMutation(
      gate,
      scopeKey,
      limits(),
      fullInput,
      () => keys[keyIndex++]!,
    );
    const duplicate = beginCardLimitsMutation(
      gate,
      scopeKey,
      limits(),
      fullInput,
      () => keys[keyIndex++]!,
    );
    expect(first?.idempotencyKey).toBe(keys[0]);
    expect(duplicate).toBeNull();
    expect(settleCardLimitsMutation(gate, first!, scopeKey)).toBeTrue();
    const second = beginCardLimitsMutation(
      gate,
      scopeKey,
      limits(),
      fullInput,
      () => keys[keyIndex++]!,
    );
    expect(second?.idempotencyKey).toBe(keys[1]);
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
    expect(() =>
      beginCardLimitsMutation(
        createCardLimitsMutationGate(scopeKey),
        scopeKey,
        limits(),
        fullInput,
        () => keys[0]!.toUpperCase(),
      ),
    ).toThrow();
  });
});

describe("Selected Card limits mutation response parser", () => {
  it("requires an ordinary public six-field own-data response and executes zero getters", () => {
    for (const value of [null, undefined, true, 1, "limits", [], new Date(), Object.create(null)]) {
      expect(() => normalizeCardLimitsUpdateResponse(value, card(), limits(), fullInput)).toThrow();
    }
    for (const field of Object.keys(response())) {
      const value: Record<string, unknown> = response();
      delete value[field];
      expect(() => normalizeCardLimitsUpdateResponse(value, card(), limits(), fullInput)).toThrow();
    }
    let executions = 0;
    const required = response();
    Object.defineProperty(required, "dailySpendMinor", {
      enumerable: true,
      get() {
        executions += 1;
        return "60000";
      },
    });
    expect(() =>
      normalizeCardLimitsUpdateResponse(required, card(), limits(), fullInput),
    ).toThrow();
    expect(executions).toBe(0);
    const unknown = response();
    Object.defineProperty(unknown, "providerOperationRef", {
      enumerable: true,
      get() {
        executions += 1;
        throw new Error("provider getter executed");
      },
    });
    const normalized = normalizeCardLimitsUpdateResponse(unknown, card(), limits(), fullInput);
    expect(executions).toBe(0);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|internal|operationRef/i);
  });

  it("requires the selected Card, exact merged values and a non-null RFC3339 timestamp", () => {
    expect(normalizeCardLimitsUpdateResponse(response(), card(), limits(), fullInput)).toEqual(
      response(),
    );
    expect(() =>
      normalizeCardLimitsUpdateResponse(
        response({ cardId: "card:other.1" }),
        card(),
        limits(),
        fullInput,
      ),
    ).toThrow();
    for (const mutation of [
      { singleTransactionMinor: "12001" },
      { dailySpendMinor: "60001" },
      { monthlySpendMinor: "600001" },
      { dailyAtmMinor: "25001" },
      { updatedAt: null },
      { updatedAt: "2026-02-30T00:00:00Z" },
    ]) {
      expect(() =>
        normalizeCardLimitsUpdateResponse(response(mutation), card(), limits(), fullInput),
      ).toThrow();
    }
    expect(
      normalizeCardLimitsUpdateResponse(
        response({
          singleTransactionMinor: "10000",
          dailySpendMinor: "55000",
          monthlySpendMinor: "500000",
          dailyAtmMinor: "20000",
        }),
        card(),
        limits(),
        { dailySpendMinor: 55000 },
      ).dailySpendMinor,
    ).toBe("55000");
  });
});

describe("Selected Card limits mutation scope, generation and writeback isolation", () => {
  it("changes scope across identity, environment, selection, Card version and every limits version field", () => {
    const oldScope = cardLimitsMutationScopeKey(session(), "SANDBOX", card(), limits());
    if (!oldScope) throw new Error("scope required");
    const changes = [
      [session({ actorId: "actor-b" }), "SANDBOX", card(), limits()],
      [session({ tenantId: "tenant-b" }), "SANDBOX", card(), limits()],
      [session({ customerId: "customer-b" }), "SANDBOX", card(), limits()],
      [session({ environment: "TEST" }), "TEST", card(), limits()],
      [session(), "SANDBOX", card({ cardId: "card:owned.2" }), limits({ cardId: "card:owned.2" })],
      [session(), "SANDBOX", card({ status: "frozen" }), limits()],
      [session(), "SANDBOX", card({ last4: "1111" }), limits()],
      [session(), "SANDBOX", card({ expiryMonth: 1 }), limits()],
      [session(), "SANDBOX", card({ expiryYear: 2031 }), limits()],
      [session(), "SANDBOX", card({ alias: "Updated" }), limits()],
      [session(), "SANDBOX", card({ availableBalanceMinor: "2600" }), limits()],
      [session(), "SANDBOX", card(), limits({ singleTransactionMinor: "11000" })],
      [session(), "SANDBOX", card(), limits({ dailySpendMinor: "51000" })],
      [session(), "SANDBOX", card(), limits({ monthlySpendMinor: "510000" })],
      [session(), "SANDBOX", card(), limits({ dailyAtmMinor: "21000" })],
      [session(), "SANDBOX", card(), limits({ updatedAt: "2026-07-31T11:00:00Z" })],
    ] as const;
    for (const [nextSession, runtime, nextCard, nextLimits] of changes) {
      expect(cardLimitsMutationScopeKey(nextSession, runtime, nextCard, nextLimits)).not.toBe(
        oldScope,
      );
    }
  });

  it("allows stale success, error and finally zero writes after limits or selection changes", () => {
    const oldLimits = limits();
    const oldScope = cardLimitsMutationScopeKey(session(), "SANDBOX", card(), oldLimits);
    const currentLimits = limits({ dailySpendMinor: "55000", updatedAt: "2026-07-31T11:00:00Z" });
    const currentScope = cardLimitsMutationScopeKey(session(), "SANDBOX", card(), currentLimits);
    if (!oldScope || !currentScope) throw new Error("scopes required");
    const gate = createCardLimitsMutationGate(oldScope);
    const ticket = beginCardLimitsMutation(gate, oldScope, oldLimits, fullInput, () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    const started = cardLimitsMutationReducer(initialCardLimitsMutationState, {
      type: "started",
      scopeKey: oldScope,
      requestKey: ticket.requestKey,
    });
    syncCardLimitsMutationScope(gate, currentScope);
    expect(acceptsCardLimitsMutationCompletion(gate, ticket, currentScope)).toBeFalse();
    const reset = cardLimitsMutationReducer(started, { type: "reset", scopeKey: currentScope });
    const staleLimits = normalizeCardLimitsUpdateResponse(response(), card(), oldLimits, fullInput);
    expect(
      cardLimitsMutationReducer(reset, {
        type: "succeeded",
        requestKey: ticket.requestKey,
        limits: staleLimits,
      }),
    ).toBe(reset);
    expect(
      cardLimitsMutationReducer(reset, {
        type: "failed",
        requestKey: ticket.requestKey,
        message: "stale limits error",
      }),
    ).toBe(reset);
    expect(
      cardLimitsMutationReducer(reset, { type: "settled", requestKey: ticket.requestKey }),
    ).toBe(reset);
    expect(cardLimitsMutationView(started, currentScope).updatedLimits).toBeNull();
  });

  it("rejects an older generation and writes accepted limits only into the current read scope", () => {
    const scopeKey = cardLimitsMutationScopeKey(session(), "SANDBOX", card(), limits());
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardLimitsMutationGate(scopeKey);
    const old = beginCardLimitsMutation(gate, scopeKey, limits(), fullInput, () => keys[0]!);
    if (!old) throw new Error("ticket required");
    settleCardLimitsMutation(gate, old, scopeKey);
    const current = beginCardLimitsMutation(gate, scopeKey, limits(), fullInput, () => keys[1]!);
    expect(acceptsCardLimitsMutationCompletion(gate, old, scopeKey)).toBeFalse();
    expect(acceptsCardLimitsMutationCompletion(gate, current!, scopeKey)).toBeTrue();

    const readScope = "selected-card-limits-scope";
    const read = { ...initialCardLimitsState, scopeKey: readScope, limits: limits() };
    const updated = normalizeCardLimitsUpdateResponse(response(), card(), limits(), fullInput);
    const accepted = cardLimitsReducer(read, {
      type: "replace-current",
      scopeKey: readScope,
      limits: updated,
    });
    const stale = cardLimitsReducer(read, {
      type: "replace-current",
      scopeKey: "foreign-scope",
      limits: updated,
    });
    expect(accepted.limits).toEqual(updated);
    expect(accepted.activeRequestKey).toBeNull();
    expect(stale).toBe(read);
  });
});
