import { describe, expect, it } from "bun:test";
import {
  buildCardReplaceRequest,
  normalizeCardReplaceResponse,
  type BackendSession,
  type CardReplacementReason,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";
import { cardListReducer, initialCardListState } from "./card-list-state";
import {
  acceptsCardReplaceCompletion,
  beginCardReplace,
  blockCardReplace,
  cardReplaceReducer,
  cardReplaceScopeKey,
  cardReplaceView,
  createCardReplaceGate,
  initialCardReplaceState,
  settleCardReplace,
  syncCardReplaceScope,
} from "./card-replace-state";

const keys = ["e5555555-eeee-4eee-aeee-eeeeeeeeeeee", "f6666666-ffff-4fff-bfff-ffffffffffff"];

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-a",
  expiresAt: "2099-08-01T00:00:00.000Z",
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

const response = (overrides: Record<string, unknown> = {}) => ({
  id: "card:replacement.2",
  type: "VIRTUAL",
  status: "ACTIVE",
  last4: "9876",
  expiryMonth: 12,
  expiryYear: 2033,
  currency: "USD",
  alias: "Primary Card",
  createdAt: "2026-07-31T14:00:00.123456789+08:00",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: true,
    updateLimits: true,
  },
  ...overrides,
});

describe("Selected Card replacement environment, reason and request gate", () => {
  it("allows only exact SANDBOX/TEST scope, replace capability and public old Card versions", () => {
    expect(cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST")).not.toBeNull();
    expect(
      cardReplaceScopeKey(
        session({ environment: "TEST" }),
        "TEST",
        card({ type: "physical", status: "frozen" }),
        "STOLEN",
      ),
    ).not.toBeNull();
    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(cardReplaceScopeKey(session({ environment }), environment, card(), "LOST")).toBeNull();
    }
    expect(cardReplaceScopeKey(session(), "TEST", card(), "LOST")).toBeNull();
    expect(cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST", 0, 0, "/api")).not.toBeNull();
    for (const apiUrl of ["", "/api/", "https://api.fastlink.invalid", "//provider.invalid"]) {
      expect(cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST", 0, 0, apiUrl)).toBeNull();
    }
    expect(
      cardReplaceScopeKey(
        session({ expiresAt: "2026-07-31T00:00:00.000Z" }),
        "SANDBOX",
        card(),
        "LOST",
      ),
    ).toBeNull();
    expect(cardReplaceScopeKey(session(), "SANDBOX", card({ expiry: "11/30" }), "LOST")).toBeNull();
    expect(
      cardReplaceScopeKey(
        session(),
        "SANDBOX",
        card({ capabilities: { ...card().capabilities, replace: false } }),
        "LOST",
      ),
    ).toBeNull();
    for (const mutation of [
      { status: "closed" as const },
      { type: "travel" as const },
      { last4: "123" },
      { expiryMonth: 0 },
      { expiryMonth: 13 },
      { expiryYear: 1999 },
      { expiryYear: 10000 },
      { currency: "usd" },
      { availableBalanceMinor: "01" },
      { availableBalanceMinor: "9223372036854775808" },
    ]) {
      expect(cardReplaceScopeKey(session(), "SANDBOX", card(mutation), "LOST")).toBeNull();
    }
    expect(
      cardReplaceScopeKey(session(), "SANDBOX", card(), "DESTROYED" as CardReplacementReason),
    ).toBeNull();
  });

  it("builds the exact public POST contract for every allowed reason", () => {
    for (const reason of ["LOST", "STOLEN", "DAMAGED", "OTHER"] as const) {
      const request = buildCardReplaceRequest(card(), reason, keys[0]!);
      const headers = new Headers(request.init.headers);
      expect(request.path).toBe("/v1/cards/card%3Aowned.1/replace");
      expect(request.init.method).toBe("POST");
      expect(headers.get("Idempotency-Key")).toBe(keys[0]);
      expect(request.init.body).toBe(JSON.stringify({ reason }));
      expect(Object.keys(request.init).sort()).toEqual(["body", "headers", "method"]);
    }
    expect(() =>
      buildCardReplaceRequest(card(), "DESTROYED" as CardReplacementReason, keys[0]!),
    ).toThrow();
  });

  it("locks duplicate submits, makes one call and issues a fresh lowercase UUIDv4", async () => {
    const scopeKey = cardReplaceScopeKey(session(), "SANDBOX", card(), "DAMAGED");
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardReplaceGate(scopeKey);
    let keyIndex = 0;
    const first = beginCardReplace(gate, scopeKey, "DAMAGED", () => keys[keyIndex++]!);
    const duplicate = beginCardReplace(gate, scopeKey, "DAMAGED", () => keys[keyIndex++]!);
    let calls = 0;
    if (first) {
      calls += 1;
      await Promise.resolve(normalizeCardReplaceResponse(response(), card()));
    }
    expect(first?.idempotencyKey).toBe(keys[0]);
    expect(duplicate).toBeNull();
    expect(calls).toBe(1);
    expect(settleCardReplace(gate, first!, scopeKey)).toBeTrue();
    const second = beginCardReplace(gate, scopeKey, "DAMAGED", () => keys[keyIndex++]!);
    expect(second?.idempotencyKey).toBe(keys[1]);
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
    expect(() =>
      beginCardReplace(createCardReplaceGate(scopeKey), scopeKey, "LOST", () =>
        keys[0]!.toUpperCase(),
      ),
    ).toThrow();
  });
});

describe("Selected Card replacement response parser", () => {
  it("accepts only ordinary JSON containers with every required own data property", () => {
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
      expect(() => normalizeCardReplaceResponse(value, card())).toThrow();
    }
    for (const field of Object.keys(response())) {
      const value: Record<string, unknown> = response();
      delete value[field];
      expect(() => normalizeCardReplaceResponse(value, card())).toThrow();
    }
  });

  it("executes zero required, optional or unknown getters and exposes only public fields", () => {
    let executions = 0;
    const required = response();
    Object.defineProperty(required, "id", {
      enumerable: true,
      get() {
        executions += 1;
        return "card:replacement.2";
      },
    });
    expect(() => normalizeCardReplaceResponse(required, card())).toThrow();
    expect(executions).toBe(0);

    const optional = response();
    Object.defineProperty(optional, "availableBalanceMinor", {
      enumerable: true,
      get() {
        executions += 1;
        return "2500";
      },
    });
    expect(() => normalizeCardReplaceResponse(optional, card())).toThrow();
    expect(executions).toBe(0);

    const unknown = response();
    Object.defineProperty(unknown, "providerOperationRef", {
      enumerable: true,
      get() {
        executions += 1;
        throw new Error("provider getter executed");
      },
    });
    const normalized = normalizeCardReplaceResponse(unknown, card());
    expect(executions).toBe(0);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|internal|operationRef/i);
  });

  it("requires a new Card ID and preserves exact public type, currency and alias", () => {
    const replacement = normalizeCardReplaceResponse(response(), card());
    expect(replacement).toMatchObject({
      cardId: "card:replacement.2",
      type: "virtual",
      status: "active",
      last4: "9876",
      expiryMonth: 12,
      expiryYear: 2033,
      currency: "USD",
      alias: "Primary Card",
    });
    for (const mutation of [
      { id: "card:owned.1" },
      { type: "PHYSICAL" },
      { type: "TRAVEL" },
      { currency: "EUR" },
      { alias: "Other Card" },
      { last4: "123" },
      { last4: "12A4" },
    ]) {
      expect(() => normalizeCardReplaceResponse(response(mutation), card())).toThrow();
    }
    expect(
      normalizeCardReplaceResponse(response({ alias: null }), card({ alias: undefined })).alias,
    ).toBeUndefined();
  });

  it("maps only exact public statuses and strictly validates expiry and capabilities", () => {
    const statuses = {
      PENDING: "pending",
      ACTIVE: "active",
      FROZEN: "frozen",
      CLOSED: "closed",
      FAILED: "failed",
    } as const;
    for (const [status, normalized] of Object.entries(statuses)) {
      expect(normalizeCardReplaceResponse(response({ status }), card()).status).toBe(normalized);
    }
    expect(() => normalizeCardReplaceResponse(response({ status: "active" }), card())).toThrow();
    for (const expiry of [
      { expiryMonth: 0 },
      { expiryMonth: 13 },
      { expiryMonth: 12.5 },
      { expiryYear: 1999 },
      { expiryYear: 10000 },
      { expiryYear: 2033.5 },
    ]) {
      expect(() => normalizeCardReplaceResponse(response(expiry), card())).toThrow();
    }
    expect(() =>
      normalizeCardReplaceResponse(
        response({ capabilities: { ...response().capabilities, replace: "true" } }),
        card(),
      ),
    ).toThrow();
  });

  it("strictly validates optional signed-64 minor units and RFC3339 createdAt", () => {
    expect(
      normalizeCardReplaceResponse(
        response({ availableBalanceMinor: "-9223372036854775808" }),
        card(),
      ).availableBalanceMinor,
    ).toBe("-9223372036854775808");
    expect(
      normalizeCardReplaceResponse(
        response({ availableBalanceMinor: "9223372036854775807" }),
        card(),
      ).availableBalanceMinor,
    ).toBe("9223372036854775807");
    for (const amount of ["01", "-0", "+1", "9223372036854775808", "-9223372036854775809", 2500]) {
      expect(() =>
        normalizeCardReplaceResponse(response({ availableBalanceMinor: amount }), card()),
      ).toThrow();
    }
    for (const createdAt of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      expect(normalizeCardReplaceResponse(response({ createdAt }), card()).createdAt).toBe(
        createdAt,
      );
    }
    for (const createdAt of [
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31",
    ]) {
      expect(() => normalizeCardReplaceResponse(response({ createdAt }), card())).toThrow();
    }
  });
});

describe("Selected Card replacement scope, generation and list isolation", () => {
  it("changes scope for identity, environment, reason, selection and every old Card version field", () => {
    const oldScope = cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST");
    if (!oldScope) throw new Error("scope required");
    const changes = [
      [session({ actorId: "actor-b" }), "SANDBOX", card(), "LOST"],
      [session({ tenantId: "tenant-b" }), "SANDBOX", card(), "LOST"],
      [session({ customerId: "customer-b" }), "SANDBOX", card(), "LOST"],
      [session({ environment: "TEST" }), "TEST", card(), "LOST"],
      [session({ expiresAt: "2099-08-01T01:00:00.000Z" }), "SANDBOX", card(), "LOST"],
      [session(), "SANDBOX", card(), "OTHER"],
      [session(), "SANDBOX", card({ cardId: "card:owned.2" }), "LOST"],
      [session(), "SANDBOX", card({ type: "physical" }), "LOST"],
      [session(), "SANDBOX", card({ status: "frozen" }), "LOST"],
      [session(), "SANDBOX", card({ last4: "1111" }), "LOST"],
      [session(), "SANDBOX", card({ expiryMonth: 1 }), "LOST"],
      [session(), "SANDBOX", card({ expiryYear: 2031 }), "LOST"],
      [session(), "SANDBOX", card({ currency: "EUR" }), "LOST"],
      [session(), "SANDBOX", card({ alias: "Updated Card" }), "LOST"],
      [session(), "SANDBOX", card({ balance: 26 }), "LOST"],
      [session(), "SANDBOX", card({ availableBalanceMinor: "2600" }), "LOST"],
      [session(), "SANDBOX", card({ createdAt: "2026-02-01T00:00:00Z" }), "LOST"],
      [
        session(),
        "SANDBOX",
        card({ capabilities: { ...card().capabilities, renew: false } }),
        "LOST",
      ],
    ] as const;
    for (const [nextSession, runtime, nextCard, reason] of changes) {
      const nextScope = cardReplaceScopeKey(
        nextSession,
        runtime,
        nextCard,
        reason as CardReplacementReason,
      );
      expect(nextScope).not.toBe(oldScope);
    }
    expect(cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST", 1, 0)).not.toBe(oldScope);
    expect(cardReplaceScopeKey(session(), "SANDBOX", card(), "LOST", 0, 1)).not.toBe(oldScope);
  });

  it("allows stale success, error and finally zero writes after scope or selection changes", () => {
    const oldCard = card();
    const oldScope = cardReplaceScopeKey(session(), "SANDBOX", oldCard, "LOST");
    const nextScope = cardReplaceScopeKey(
      session(),
      "SANDBOX",
      card({ cardId: "card:owned.2" }),
      "LOST",
    );
    if (!oldScope || !nextScope) throw new Error("scopes required");
    const gate = createCardReplaceGate(oldScope);
    const ticket = beginCardReplace(gate, oldScope, "LOST", () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    const started = cardReplaceReducer(initialCardReplaceState, {
      type: "started",
      scopeKey: oldScope,
      requestKey: ticket.requestKey,
    });
    syncCardReplaceScope(gate, nextScope);
    expect(acceptsCardReplaceCompletion(gate, ticket, nextScope)).toBeFalse();
    const reset = cardReplaceReducer(started, { type: "reset", scopeKey: nextScope });
    expect(
      cardReplaceReducer(reset, {
        type: "succeeded",
        requestKey: ticket.requestKey,
        card: normalizeCardReplaceResponse(response(), oldCard),
      }),
    ).toBe(reset);
    expect(
      cardReplaceReducer(reset, {
        type: "failed",
        requestKey: ticket.requestKey,
        message: "foreign error",
      }),
    ).toBe(reset);
    expect(cardReplaceReducer(reset, { type: "settled", requestKey: ticket.requestKey })).toBe(
      reset,
    );
    expect(cardReplaceView(started, nextScope).replacementCard).toBeNull();
  });

  it("allows an old completion zero writes after the same Card balance refreshes", () => {
    const oldCard = card({ availableBalanceMinor: "2500", balance: 25 });
    const currentCard = card({ availableBalanceMinor: "2750", balance: 27.5 });
    const oldScope = cardReplaceScopeKey(session(), "SANDBOX", oldCard, "LOST");
    const currentScope = cardReplaceScopeKey(session(), "SANDBOX", currentCard, "LOST");
    const noBalanceScope = cardReplaceScopeKey(
      session(),
      "SANDBOX",
      card({ availableBalanceMinor: undefined }),
      "LOST",
    );
    if (!oldScope || !currentScope || !noBalanceScope) throw new Error("scopes required");
    expect(currentScope).not.toBe(oldScope);
    expect(noBalanceScope).not.toBe(oldScope);

    const gate = createCardReplaceGate(oldScope);
    const ticket = beginCardReplace(gate, oldScope, "LOST", () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    const started = cardReplaceReducer(initialCardReplaceState, {
      type: "started",
      scopeKey: oldScope,
      requestKey: ticket.requestKey,
    });
    syncCardReplaceScope(gate, currentScope);
    expect(acceptsCardReplaceCompletion(gate, ticket, currentScope)).toBeFalse();
    const reset = cardReplaceReducer(started, { type: "reset", scopeKey: currentScope });

    const staleReplacement = normalizeCardReplaceResponse(response(), oldCard);
    expect(staleReplacement.availableBalanceMinor).toBe("2500");
    expect(
      cardReplaceReducer(reset, {
        type: "succeeded",
        requestKey: ticket.requestKey,
        card: staleReplacement,
      }),
    ).toBe(reset);
    expect(
      cardReplaceReducer(reset, {
        type: "failed",
        requestKey: ticket.requestKey,
        message: "stale balance error",
      }),
    ).toBe(reset);
    expect(cardReplaceReducer(reset, { type: "settled", requestKey: ticket.requestKey })).toBe(
      reset,
    );
    expect(cardReplaceView(started, currentScope).replacementCard).toBeNull();
  });

  it("rejects an older generation inside one replacement scope", () => {
    const scopeKey = cardReplaceScopeKey(session(), "SANDBOX", card(), "OTHER");
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardReplaceGate(scopeKey);
    const old = beginCardReplace(gate, scopeKey, "OTHER", () => keys[0]!);
    if (!old) throw new Error("ticket required");
    settleCardReplace(gate, old, scopeKey);
    const current = beginCardReplace(gate, scopeKey, "OTHER", () => keys[1]!);
    expect(acceptsCardReplaceCompletion(gate, old, scopeKey)).toBeFalse();
    expect(acceptsCardReplaceCompletion(gate, current!, scopeKey)).toBeTrue();
  });

  it("blocks a second POST in the same exact scope after a persisted result cannot be confirmed", () => {
    const scopeKey = cardReplaceScopeKey(session(), "SANDBOX", card(), "OTHER");
    if (!scopeKey) throw new Error("scope required");
    const gate = createCardReplaceGate(scopeKey);
    const ticket = beginCardReplace(gate, scopeKey, "OTHER", () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    expect(blockCardReplace(gate, ticket, scopeKey)).toBeTrue();
    expect(settleCardReplace(gate, ticket, scopeKey)).toBeTrue();
    expect(beginCardReplace(gate, scopeKey, "OTHER", () => keys[1]!)).toBeNull();
    const started = cardReplaceReducer(initialCardReplaceState, {
      type: "started",
      scopeKey,
      requestKey: ticket.requestKey,
    });
    const conflicted = cardReplaceReducer(started, {
      type: "conflicted",
      requestKey: ticket.requestKey,
      message: "safe conflict",
    });
    expect(conflicted.conflictPending).toBeTrue();
    expect(conflicted.replacementCard).toBeNull();
  });

  it("atomically removes only the selected old Card and selects a collision-free replacement", () => {
    const sessionKey = JSON.stringify(["actor-a", "tenant-a", "customer-a", "SANDBOX"]);
    const oldCard = card();
    const other = card({ cardId: "card:owned.3", last4: "3333" });
    const replacement = normalizeCardReplaceResponse(response(), oldCard);
    const loaded = {
      ...initialCardListState,
      sessionKey,
      cards: [oldCard, other],
      activeId: oldCard.cardId,
    };
    const replaced = cardListReducer(loaded, {
      type: "replace-selected",
      sessionKey,
      oldCardId: oldCard.cardId,
      card: replacement,
    });
    expect(replaced.cards.map((item) => item.cardId)).toEqual([replacement.cardId, other.cardId]);
    expect(replaced.activeId).toBe(replacement.cardId);

    for (const action of [
      {
        type: "replace-selected" as const,
        sessionKey: "foreign",
        oldCardId: oldCard.cardId,
        card: replacement,
      },
      {
        type: "replace-selected" as const,
        sessionKey,
        oldCardId: other.cardId,
        card: replacement,
      },
      {
        type: "replace-selected" as const,
        sessionKey,
        oldCardId: oldCard.cardId,
        card: other,
      },
    ]) {
      expect(cardListReducer(loaded, action)).toBe(loaded);
    }
  });
});
