import { describe, expect, it } from "bun:test";
import {
  buildCardRenewRequest,
  normalizeCardRenewResponse,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";
import { cardListReducer, initialCardListState } from "./card-list-state";
import {
  acceptsCardRenewCompletion,
  beginCardRenew,
  cardRenewReducer,
  cardRenewScopeKey,
  cardRenewView,
  createCardRenewGate,
  initialCardRenewState,
  settleCardRenew,
  syncCardRenewScope,
} from "./card-renew-state";

const keys = ["c3333333-cccc-4ccc-8ccc-cccccccccccc", "d4444444-dddd-4ddd-9ddd-dddddddddddd"];

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
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: true,
    updateLimits: true,
  },
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  id: "card:owned.1",
  type: "VIRTUAL",
  status: "ACTIVE",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2033,
  currency: "USD",
  alias: "Primary Card",
  createdAt: "2026-07-31T12:00:00.123456789+08:00",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: true,
    updateLimits: true,
  },
  ...overrides,
});

describe("Selected Card renew environment, capability and request gate", () => {
  it("allows only exact SANDBOX/TEST scope with renew capability and valid old expiry", () => {
    expect(cardRenewScopeKey(session(), "SANDBOX", card())).not.toBeNull();
    expect(
      cardRenewScopeKey(session({ environment: "TEST" }), "TEST", card({ status: "frozen" })),
    ).not.toBeNull();

    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(cardRenewScopeKey(session({ environment }), environment, card())).toBeNull();
    }
    expect(cardRenewScopeKey(session(), "TEST", card())).toBeNull();
    expect(
      cardRenewScopeKey(
        session(),
        "SANDBOX",
        card({ capabilities: { ...card().capabilities, renew: false } }),
      ),
    ).toBeNull();
    expect(cardRenewScopeKey(session(), "SANDBOX", card({ status: "closed" }))).toBeNull();
    expect(cardRenewScopeKey(session(), "SANDBOX", card({ expiryYear: undefined }))).toBeNull();
    for (const invalidExpiry of [
      { expiryMonth: 0 },
      { expiryMonth: 13 },
      { expiryMonth: 1.5 },
      { expiryYear: 1999 },
      { expiryYear: 10000 },
      { expiryYear: 2030.5 },
    ]) {
      expect(cardRenewScopeKey(session(), "SANDBOX", card(invalidExpiry))).toBeNull();
    }
    expect(cardRenewScopeKey(null, "SANDBOX", card())).toBeNull();
  });

  it("builds the exact public POST contract without a body", () => {
    const request = buildCardRenewRequest(card(), keys[0]!);
    const headers = new Headers(request.init.headers);

    expect(request.path).toBe("/v1/cards/card%3Aowned.1/renew");
    expect(request.init.method).toBe("POST");
    expect(headers.get("Idempotency-Key")).toBe(keys[0]);
    expect(request.init.body).toBeUndefined();
    expect(Object.keys(request.init).sort()).toEqual(["headers", "method"]);
  });

  it("locks duplicate clicks, makes one call, and issues a unique UUIDv4 per accepted submit", async () => {
    const scopeKey = cardRenewScopeKey(session(), "SANDBOX", card());
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardRenewGate(scopeKey);
    let keyIndex = 0;
    const first = beginCardRenew(gate, scopeKey, () => keys[keyIndex++]!);
    const duplicate = beginCardRenew(gate, scopeKey, () => keys[keyIndex++]!);
    let calls = 0;
    if (first) {
      calls += 1;
      await Promise.resolve(normalizeCardRenewResponse(response(), card()));
    }

    expect(first?.idempotencyKey).toBe(keys[0]);
    expect(duplicate).toBeNull();
    expect(calls).toBe(1);
    expect(settleCardRenew(gate, first!, scopeKey)).toBeTrue();
    const second = beginCardRenew(gate, scopeKey, () => keys[keyIndex++]!);
    expect(second?.idempotencyKey).toBe(keys[1]);
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
  });
});

describe("Selected Card renew response parser", () => {
  it("accepts only ordinary JSON containers with required own data properties", () => {
    for (const value of [
      null,
      undefined,
      true,
      1,
      "card",
      [],
      new Date(),
      new Map(),
      Object.create(null),
    ]) {
      expect(() => normalizeCardRenewResponse(value, card())).toThrow();
    }
    for (const field of Object.keys(response())) {
      const value: Record<string, unknown> = response();
      delete value[field];
      expect(() => normalizeCardRenewResponse(value, card())).toThrow();
    }
  });

  it("executes zero required/unknown getters and never reflects provider or internal fields", () => {
    const required = response();
    let executions = 0;
    Object.defineProperty(required, "expiryYear", {
      enumerable: true,
      get() {
        executions += 1;
        return 2033;
      },
    });
    expect(() => normalizeCardRenewResponse(required, card())).toThrow();
    expect(executions).toBe(0);

    const unknown = response();
    Object.defineProperty(unknown, "providerOperationRef", {
      enumerable: true,
      get() {
        executions += 1;
        throw new Error("provider getter executed");
      },
    });
    const normalized = normalizeCardRenewResponse(unknown, card());
    expect(executions).toBe(0);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|internal|operationRef/i);

    const capabilities = response().capabilities as Record<string, unknown>;
    Object.defineProperty(capabilities, "internalTransition", {
      enumerable: true,
      get() {
        executions += 1;
        throw new Error("internal getter executed");
      },
    });
    normalizeCardRenewResponse(response({ capabilities }), card());
    expect(executions).toBe(0);
  });

  it("requires the same Card identity, public type, status, last4, currency and alias", () => {
    const expected = card();
    const renewed = normalizeCardRenewResponse(response(), expected);
    expect(renewed).toMatchObject({
      cardId: expected.cardId,
      type: expected.type,
      status: expected.status,
      last4: expected.last4,
      currency: expected.currency,
      alias: expected.alias,
      expiryMonth: 12,
      expiryYear: 2033,
    });
    expect(renewed.balance).toBe(expected.balance);
    expect(renewed.availableBalanceMinor).toBe(expected.availableBalanceMinor);

    for (const mutation of [
      { id: "card:other.1" },
      { type: "PHYSICAL" },
      { status: "FROZEN" },
      { last4: "1111" },
      { currency: "EUR" },
      { alias: "Other Card" },
    ]) {
      expect(() => normalizeCardRenewResponse(response(mutation), expected)).toThrow();
    }
    expect(
      normalizeCardRenewResponse(response({ alias: null }), card({ alias: undefined })).alias,
    ).toBeUndefined();
  });

  it("requires a strictly later valid expiry and exact capability booleans", () => {
    for (const expiry of [
      { expiryMonth: 12, expiryYear: 2030 },
      { expiryMonth: 11, expiryYear: 2030 },
      { expiryMonth: 0, expiryYear: 2033 },
      { expiryMonth: 13, expiryYear: 2033 },
      { expiryMonth: 12.5, expiryYear: 2033 },
      { expiryMonth: 12, expiryYear: 2033.5 },
    ]) {
      expect(() => normalizeCardRenewResponse(response(expiry), card())).toThrow();
    }
    expect(
      normalizeCardRenewResponse(response({ expiryMonth: 1, expiryYear: 2031 }), card()).expiry,
    ).toBe("01/31");
    expect(() =>
      normalizeCardRenewResponse(
        response({ capabilities: { ...response().capabilities, renew: "true" } }),
        card(),
      ),
    ).toThrow();
  });

  it("enforces RFC3339 createdAt", () => {
    for (const createdAt of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      expect(normalizeCardRenewResponse(response({ createdAt }), card()).createdAt).toBe(createdAt);
    }
    for (const createdAt of [
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31",
    ]) {
      expect(() => normalizeCardRenewResponse(response({ createdAt }), card())).toThrow();
    }
  });
});

describe("Selected Card renew scope and generation isolation", () => {
  it("allows an old completion zero writes when the same Card ID has a newer expiry", () => {
    const oldCard = card();
    const oldScope = cardRenewScopeKey(session(), "SANDBOX", oldCard);
    const currentCard = card({ expiry: "12/33", expiryMonth: 12, expiryYear: 2033 });
    const currentScope = cardRenewScopeKey(session(), "SANDBOX", currentCard);
    if (!oldScope || !currentScope) throw new Error("scopes required");
    expect(currentScope).not.toBe(oldScope);

    const gate = createCardRenewGate(oldScope);
    const ticket = beginCardRenew(gate, oldScope, () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    const started = cardRenewReducer(initialCardRenewState, {
      type: "started",
      scopeKey: oldScope,
      requestKey: ticket.requestKey,
    });

    syncCardRenewScope(gate, currentScope);
    expect(acceptsCardRenewCompletion(gate, ticket, currentScope)).toBeFalse();
    const reset = cardRenewReducer(started, { type: "reset", scopeKey: currentScope });
    const oldSuccess = cardRenewReducer(reset, {
      type: "succeeded",
      requestKey: ticket.requestKey,
      card: normalizeCardRenewResponse(response(), oldCard),
    });
    const oldError = cardRenewReducer(reset, {
      type: "failed",
      requestKey: ticket.requestKey,
      message: "stale renewal error",
    });
    const oldFinally = cardRenewReducer(reset, {
      type: "settled",
      requestKey: ticket.requestKey,
    });

    expect(oldSuccess).toBe(reset);
    expect(oldError).toBe(reset);
    expect(oldFinally).toBe(reset);
    expect(cardRenewView(started, currentScope).renewedCard).toBeNull();
  });

  it("allows stale success/error/finally zero writes after identity, environment or Card changes", () => {
    const oldScope = cardRenewScopeKey(session(), "SANDBOX", card());
    if (!oldScope) throw new Error("scope required");
    const changes = [
      [session({ actorId: "actor-b" }), "SANDBOX", card()],
      [session({ tenantId: "tenant-b" }), "SANDBOX", card()],
      [session({ customerId: "customer-b" }), "SANDBOX", card()],
      [session({ environment: "TEST" }), "TEST", card()],
      [session(), "SANDBOX", card({ cardId: "card:owned.2" })],
    ] as const;

    for (const [nextSession, runtime, nextCard] of changes) {
      const gate = createCardRenewGate(oldScope);
      const ticket = beginCardRenew(gate, oldScope, () => keys[0]!);
      if (!ticket) throw new Error("ticket required");
      const started = cardRenewReducer(initialCardRenewState, {
        type: "started",
        scopeKey: oldScope,
        requestKey: ticket.requestKey,
      });
      const nextScope = cardRenewScopeKey(nextSession, runtime, nextCard);
      syncCardRenewScope(gate, nextScope);
      expect(acceptsCardRenewCompletion(gate, ticket, nextScope)).toBeFalse();
      const reset = cardRenewReducer(started, { type: "reset", scopeKey: nextScope });
      expect(
        cardRenewReducer(reset, {
          type: "succeeded",
          requestKey: ticket.requestKey,
          card: normalizeCardRenewResponse(response(), card()),
        }),
      ).toBe(reset);
      expect(
        cardRenewReducer(reset, {
          type: "failed",
          requestKey: ticket.requestKey,
          message: "foreign error",
        }),
      ).toBe(reset);
      expect(cardRenewReducer(reset, { type: "settled", requestKey: ticket.requestKey })).toBe(
        reset,
      );
      expect(cardRenewView(started, nextScope).renewedCard).toBeNull();
    }
  });

  it("rejects an older generation within the same Card scope", () => {
    const scopeKey = cardRenewScopeKey(session(), "SANDBOX", card());
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardRenewGate(scopeKey);
    const old = beginCardRenew(gate, scopeKey, () => keys[0]!);
    if (!old) throw new Error("ticket required");
    settleCardRenew(gate, old, scopeKey);
    const current = beginCardRenew(gate, scopeKey, () => keys[1]!);
    expect(acceptsCardRenewCompletion(gate, old, scopeKey)).toBeFalse();
    expect(acceptsCardRenewCompletion(gate, current!, scopeKey)).toBeTrue();
  });

  it("updates and keeps selection only in the current list scope", () => {
    const sessionKey = JSON.stringify(["actor-a", "tenant-a", "customer-a", "SANDBOX"]);
    const original = card();
    const renewed = normalizeCardRenewResponse(response(), original);
    const loaded = {
      ...initialCardListState,
      sessionKey,
      cards: [original, card({ cardId: "card:owned.2", last4: "1111" })],
      activeId: original.cardId,
    };
    const updated = cardListReducer(loaded, { type: "replace", sessionKey, card: renewed });
    const selected = cardListReducer(updated, {
      type: "select",
      sessionKey,
      cardId: renewed.cardId,
    });
    const stale = cardListReducer(loaded, {
      type: "replace",
      sessionKey: `${sessionKey}-foreign`,
      card: renewed,
    });

    expect(selected.cards[0]?.expiry).toBe("12/33");
    expect(selected.activeId).toBe(original.cardId);
    expect(stale).toBe(loaded);
  });
});
