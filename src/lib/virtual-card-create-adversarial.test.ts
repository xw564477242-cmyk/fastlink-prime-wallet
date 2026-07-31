import { describe, expect, it } from "bun:test";
import {
  buildVirtualCardCreateRequest,
  normalizeVirtualCardCreateInput,
  normalizeVirtualCardCreateResponse,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";
import { cardListReducer, initialCardListState } from "./card-list-state";
import {
  acceptsVirtualCardCreateCompletion,
  beginVirtualCardCreate,
  createVirtualCardCreateGate,
  settleVirtualCardCreate,
  syncVirtualCardCreateScope,
  virtualCardCreateReducer,
  virtualCardCreateScopeKey,
  virtualCardCreateView,
  initialVirtualCardCreateState,
} from "./virtual-card-create-state";

const keys = ["a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "b2222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb"];

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-a",
  tenantId: "tenant-a",
  customerId: "customer-a",
  environment: "SANDBOX",
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  id: "card:virtual.1",
  type: "VIRTUAL",
  status: "ACTIVE",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "New Virtual",
  availableBalanceMinor: "0",
  createdAt: "2026-07-31T12:00:00.123456789+08:00",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: false,
    renew: false,
    updateLimits: true,
  },
  ...overrides,
});

const card = (): WalletCard => normalizeVirtualCardCreateResponse(response());

describe("Virtual Card creation environment and request gate", () => {
  it("allows only an exact SANDBOX or TEST runtime/session match", () => {
    expect(virtualCardCreateScopeKey(session(), "SANDBOX")).not.toBeNull();
    expect(virtualCardCreateScopeKey(session({ environment: "TEST" }), "TEST")).not.toBeNull();

    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(virtualCardCreateScopeKey(session({ environment }), environment)).toBeNull();
    }
    expect(virtualCardCreateScopeKey(session(), "TEST")).toBeNull();
    expect(virtualCardCreateScopeKey(session({ environment: "TEST" }), "SANDBOX")).toBeNull();
    expect(virtualCardCreateScopeKey(null, "SANDBOX")).toBeNull();
    expect(virtualCardCreateScopeKey(session(), undefined)).toBeNull();
  });

  it("locks duplicate synchronous submits and gives each accepted submit one unique key", async () => {
    const scopeKey = virtualCardCreateScopeKey(session(), "SANDBOX");
    if (!scopeKey) throw new Error("scope required");
    const gate = createVirtualCardCreateGate(scopeKey);
    let keyIndex = 0;
    const first = beginVirtualCardCreate(gate, scopeKey, () => keys[keyIndex++]!);
    const duplicate = beginVirtualCardCreate(gate, scopeKey, () => keys[keyIndex++]!);
    let calls = 0;
    if (first) {
      calls += 1;
      await Promise.resolve(card());
    }

    expect(first?.idempotencyKey).toBe(keys[0]);
    expect(duplicate).toBeNull();
    expect(calls).toBe(1);
    expect(settleVirtualCardCreate(gate, first!, scopeKey)).toBeTrue();

    const second = beginVirtualCardCreate(gate, scopeKey, () => keys[keyIndex++]!);
    expect(second?.idempotencyKey).toBe(keys[1]);
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
  });

  it("requires canonical v4 idempotency keys", () => {
    expect(validateVirtualCardIdempotencyKey(keys[0])).toBe(keys[0]);
    for (const key of [
      "",
      "trace-1",
      "11111111-1111-1111-8111-111111111111",
      keys[0]!.toUpperCase(),
    ]) {
      expect(() => validateVirtualCardIdempotencyKey(key)).toThrow();
    }
  });

  it("builds exactly one POST contract with the user-submit idempotency key", () => {
    const request = buildVirtualCardCreateRequest(
      { currency: "USD", alias: "New Virtual" },
      keys[0]!,
    );
    const headers = new Headers(request.init.headers);

    expect(request.path).toBe("/v1/cards/virtual");
    expect(request.init.method).toBe("POST");
    expect(headers.get("Idempotency-Key")).toBe(keys[0]);
    expect(request.init.body).toBe('{"currency":"USD","alias":"New Virtual"}');
    expect(Object.keys(request.init).sort()).toEqual(["body", "headers", "method"]);
  });

  it("strictly normalizes currency and alias without executing getters", () => {
    expect(normalizeVirtualCardCreateInput({ currency: "USD", alias: "新虚拟卡" })).toEqual({
      currency: "USD",
      alias: "新虚拟卡",
    });
    expect(normalizeVirtualCardCreateInput({ currency: "EUR" })).toEqual({ currency: "EUR" });
    for (const currency of ["usd", "US", "USDT", "U1D", 1, null]) {
      expect(() => normalizeVirtualCardCreateInput({ currency })).toThrow();
    }
    for (const alias of ["", " alias", "alias ", "bad/alias", "x".repeat(65), 1, null]) {
      expect(() => normalizeVirtualCardCreateInput({ currency: "USD", alias })).toThrow();
    }

    let getterExecutions = 0;
    const input = { currency: "USD" };
    Object.defineProperty(input, "alias", {
      enumerable: true,
      get() {
        getterExecutions += 1;
        return "unsafe";
      },
    });
    expect(() => normalizeVirtualCardCreateInput(input)).toThrow();
    expect(getterExecutions).toBe(0);
  });
});

describe("Virtual Card creation response parser", () => {
  it("accepts only ordinary JSON containers with required own data fields", () => {
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
      expect(() => normalizeVirtualCardCreateResponse(value)).toThrow();
    }
    for (const field of Object.keys(response())) {
      const value: Record<string, unknown> = response();
      delete value[field];
      expect(() => normalizeVirtualCardCreateResponse(value)).toThrow();
    }
  });

  it("executes zero required or unknown getters and never reflects internal fields", () => {
    const required = response();
    let requiredExecutions = 0;
    Object.defineProperty(required, "last4", {
      enumerable: true,
      get() {
        requiredExecutions += 1;
        return "4242";
      },
    });
    expect(() => normalizeVirtualCardCreateResponse(required)).toThrow();
    expect(requiredExecutions).toBe(0);

    const unknown = response();
    let unknownExecutions = 0;
    Object.defineProperty(unknown, "providerPayload", {
      enumerable: true,
      get() {
        unknownExecutions += 1;
        throw new Error("provider getter executed");
      },
    });
    const normalized = normalizeVirtualCardCreateResponse(unknown);
    expect(unknownExecutions).toBe(0);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|internal|payload/i);

    const capabilities = response().capabilities as Record<string, unknown>;
    Object.defineProperty(capabilities, "providerControl", {
      enumerable: true,
      get() {
        unknownExecutions += 1;
        throw new Error("capability getter executed");
      },
    });
    normalizeVirtualCardCreateResponse(response({ capabilities }));
    expect(unknownExecutions).toBe(0);
  });

  it("enforces opaque Card ID, exact public enums, last4, expiry and capabilities", () => {
    const normalized = normalizeVirtualCardCreateResponse(
      response({ id: "card:virtual.opaque-1", status: "PENDING" }),
    );
    expect(normalized.cardId).toBe("card:virtual.opaque-1");
    expect(normalized.type).toBe("virtual");
    expect(normalized.status).toBe("pending");
    expect(normalized.last4).toBe("4242");
    expect(normalized.expiry).toBe("12/30");

    for (const type of ["virtual", "PHYSICAL", "", 1]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ type }))).toThrow();
    }
    for (const status of ["active", "UNKNOWN", "", 1]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ status }))).toThrow();
    }
    for (const last4 of ["424", "04242", "42A2", 4242]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ last4 }))).toThrow();
    }
    for (const expiryMonth of [0, 13, 1.5, "12"]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ expiryMonth }))).toThrow();
    }
    for (const expiryYear of [1999, 10000, 2030.5, "2030"]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ expiryYear }))).toThrow();
    }
    expect(() =>
      normalizeVirtualCardCreateResponse(
        response({ capabilities: { ...response().capabilities, freeze: "true" } }),
      ),
    ).toThrow();
  });

  it("preserves canonical signed-64 and RFC3339 boundaries", () => {
    for (const availableBalanceMinor of [
      "-9223372036854775808",
      "-1",
      "0",
      "9223372036854775807",
    ]) {
      expect(
        normalizeVirtualCardCreateResponse(response({ availableBalanceMinor }))
          .availableBalanceMinor,
      ).toBe(availableBalanceMinor);
    }
    for (const availableBalanceMinor of [
      "-9223372036854775809",
      "9223372036854775808",
      "-0",
      "+1",
      "01",
      "1.0",
      1,
    ]) {
      expect(() =>
        normalizeVirtualCardCreateResponse(response({ availableBalanceMinor })),
      ).toThrow();
    }
    for (const createdAt of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      expect(normalizeVirtualCardCreateResponse(response({ createdAt })).createdAt).toBe(createdAt);
    }
    for (const createdAt of [
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31",
    ]) {
      expect(() => normalizeVirtualCardCreateResponse(response({ createdAt }))).toThrow();
    }
  });
});

describe("Virtual Card creation scope and completion isolation", () => {
  it("allows stale success, error and finally zero writes after every scope dimension changes", () => {
    const oldScope = virtualCardCreateScopeKey(session(), "SANDBOX");
    if (!oldScope) throw new Error("scope required");
    const gate = createVirtualCardCreateGate(oldScope);
    const ticket = beginVirtualCardCreate(gate, oldScope, () => keys[0]!);
    if (!ticket) throw new Error("ticket required");
    const started = virtualCardCreateReducer(initialVirtualCardCreateState, {
      type: "started",
      scopeKey: oldScope,
      requestKey: ticket.requestKey,
    });
    const changedSessions = [
      session({ actorId: "actor-b" }),
      session({ tenantId: "tenant-b" }),
      session({ customerId: "customer-b" }),
      session({ environment: "TEST" }),
    ];

    for (const nextSession of changedSessions) {
      const runtime = nextSession.environment;
      const nextScope = virtualCardCreateScopeKey(nextSession, runtime);
      syncVirtualCardCreateScope(gate, nextScope);
      expect(acceptsVirtualCardCreateCompletion(gate, ticket, nextScope)).toBeFalse();
      const reset = virtualCardCreateReducer(started, { type: "reset", scopeKey: nextScope });
      expect(
        virtualCardCreateReducer(reset, {
          type: "succeeded",
          requestKey: ticket.requestKey,
          card: card(),
        }),
      ).toBe(reset);
      expect(
        virtualCardCreateReducer(reset, {
          type: "failed",
          requestKey: ticket.requestKey,
          message: "foreign failure",
        }),
      ).toBe(reset);
      expect(
        virtualCardCreateReducer(reset, {
          type: "settled",
          requestKey: ticket.requestKey,
        }),
      ).toBe(reset);
      expect(virtualCardCreateView(started, nextScope).createdCard).toBeNull();
    }
  });

  it("rejects an older generation in the same scope", () => {
    const scopeKey = virtualCardCreateScopeKey(session(), "SANDBOX");
    if (!scopeKey) throw new Error("scope required");
    const gate = createVirtualCardCreateGate(scopeKey);
    const old = beginVirtualCardCreate(gate, scopeKey, () => keys[0]!);
    if (!old) throw new Error("ticket required");
    settleVirtualCardCreate(gate, old, scopeKey);
    const current = beginVirtualCardCreate(gate, scopeKey, () => keys[1]!);
    expect(current).not.toBeNull();
    expect(acceptsVirtualCardCreateCompletion(gate, old, scopeKey)).toBeFalse();
    expect(acceptsVirtualCardCreateCompletion(gate, current!, scopeKey)).toBeTrue();
  });

  it("safely prepends and selects an accepted created Card in the current list scope", () => {
    const sessionKey = JSON.stringify(["actor-a", "tenant-a", "customer-a", "SANDBOX"]);
    const loaded = {
      ...initialCardListState,
      sessionKey,
      cards: [normalizeVirtualCardCreateResponse(response({ id: "card:virtual.old" }))],
      activeId: "card:virtual.old",
    };
    const created = card();
    const next = cardListReducer(loaded, { type: "prepend", sessionKey, card: created });
    const stale = cardListReducer(loaded, {
      type: "prepend",
      sessionKey: `${sessionKey}-changed`,
      card: created,
    });

    expect(next.cards[0]?.cardId).toBe(created.cardId);
    expect(next.activeId).toBe(created.cardId);
    expect(stale).toBe(loaded);
  });
});
