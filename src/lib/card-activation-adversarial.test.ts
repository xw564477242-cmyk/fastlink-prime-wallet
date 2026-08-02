import { describe, expect, it } from "bun:test";
import {
  buildCardActivationRequest,
  cardActivationSessionAllowed,
  normalizeCardActivationSnapshot,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";
import {
  acceptsCardActivationCompletion,
  beginCardActivation,
  blockCardActivation,
  cardActivationFailureIsAmbiguous,
  cardActivationFailureIsExplicit401,
  cardActivationScopeKey,
  createCardActivationGate,
  retainCardActivationRetry,
  settleCardActivation,
  syncCardActivationScope,
} from "./card-activation-state";

const keys = ["a0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-9000-000000000002"];

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-activate-a",
  expiresAt: "2099-08-03T00:00:00.000Z",
  tenantId: "tenant-activate-a",
  customerId: "customer-activate-a",
  environment: "SANDBOX",
  ...overrides,
});

const card = (overrides: Partial<WalletCard> = {}): WalletCard => ({
  cardId: "card_pending_1",
  type: "physical",
  status: "pending",
  last4: "4242",
  expiry: "12/30",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Owned Pending Card",
  balance: 25,
  availableBalanceMinor: "2500",
  createdAt: "2026-08-01T00:00:00Z",
  capabilities: {
    freeze: false,
    unfreeze: false,
    replace: false,
    renew: false,
    updateLimits: true,
  },
  ...overrides,
});

const activeSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: "card_pending_1",
  type: "PHYSICAL",
  status: "ACTIVE",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Owned Pending Card",
  availableBalanceMinor: "2500",
  createdAt: "2026-08-01T00:00:00Z",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: true,
    updateLimits: true,
  },
  ...overrides,
});

describe("Prime Card activation runtime, request and refresh contract", () => {
  it("allows only same-origin /api with a matching unexpired SANDBOX/TEST Session", () => {
    expect(cardActivationSessionAllowed(session(), "SANDBOX", "/api")).toBeTrue();
    expect(
      cardActivationSessionAllowed(session({ environment: "TEST" }), "TEST", "/api"),
    ).toBeTrue();
    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(
        cardActivationSessionAllowed(session({ environment }), environment, "/api"),
      ).toBeFalse();
    }
    expect(cardActivationSessionAllowed(session(), "TEST", "/api")).toBeFalse();
    expect(
      cardActivationSessionAllowed(session(), "SANDBOX", "https://api.example.test"),
    ).toBeFalse();
    expect(
      cardActivationSessionAllowed(
        session({ expiresAt: "2020-01-01T00:00:00Z" }),
        "SANDBOX",
        "/api",
      ),
    ).toBeFalse();
  });

  it("builds only the formal bodyless POST with one scoped idempotency key", () => {
    const request = buildCardActivationRequest(card(), keys[0]!);
    expect(request.path).toBe("/v1/cards/card_pending_1/activate");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBeUndefined();
    expect(Object.keys(request.init).sort()).toEqual(["headers", "method"]);
    expect(new Headers(request.init.headers).get("Idempotency-Key")).toBe(keys[0]);
    for (const invalid of [
      card({ cardId: "card:legacy" }),
      card({ status: "active" }),
      card({ type: "travel" }),
    ]) {
      expect(() => buildCardActivationRequest(invalid, keys[0]!)).toThrow();
    }
  });

  it("accepts ACTIVE only from an exact fresh Card snapshot and rejects internal or PIN/CVV fields", () => {
    const normalized = normalizeCardActivationSnapshot(JSON.stringify(activeSnapshot()), card());
    expect(normalized.status).toBe("active");
    expect(normalized.cardId).toBe(card().cardId);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|tenant|customer|pin|cvv/i);
    for (const patch of [
      { id: "card_foreign" },
      { status: "PENDING" },
      { last4: "9999" },
      { currency: "EUR" },
      { pin: "1234" },
      { cvv: "999" },
      { providerOperationRef: "provider-secret" },
      { capabilities: { ...activeSnapshot().capabilities, freeze: false } },
    ]) {
      expect(() =>
        normalizeCardActivationSnapshot(JSON.stringify(activeSnapshot(patch)), card()),
      ).toThrow();
    }
  });
});

describe("Prime Card activation exact identity and late-completion isolation", () => {
  it("shows activation only for a PENDING Card and binds every Session/environment/Card version", () => {
    const scope = cardActivationScopeKey(session(), "SANDBOX", "/api", card(), 3, 5);
    expect(scope).not.toBeNull();
    expect(
      cardActivationScopeKey(session(), "SANDBOX", "/api", card({ status: "active" })),
    ).toBeNull();
    const changes: Array<[BackendSession, WalletCard, number, number]> = [
      [session({ actorId: "actor-activate-b" }), card(), 3, 5],
      [session({ tenantId: "tenant-activate-b" }), card(), 3, 5],
      [session({ customerId: "customer-activate-b" }), card(), 3, 5],
      [session({ expiresAt: "2099-08-03T01:00:00.000Z" }), card(), 3, 5],
      [session(), card({ cardId: "card_pending_2" }), 3, 5],
      [session(), card({ last4: "5252" }), 3, 5],
      [session(), card({ alias: "Changed" }), 3, 5],
      [session(), card(), 4, 5],
      [session(), card(), 3, 6],
    ];
    for (const [nextSession, nextCard, sessionGeneration, cardGeneration] of changes) {
      expect(
        cardActivationScopeKey(
          nextSession,
          "SANDBOX",
          "/api",
          nextCard,
          sessionGeneration,
          cardGeneration,
        ),
      ).not.toBe(scope);
    }
  });

  it("synchronously rejects duplicates and all old Session/Card/unmount completions", () => {
    const scope = cardActivationScopeKey(session(), "SANDBOX", "/api", card(), 1, 1)!;
    const gate = createCardActivationGate(scope);
    const first = beginCardActivation(gate, scope, () => keys[0]!);
    expect(first).not.toBeNull();
    expect(beginCardActivation(gate, scope, () => keys[1]!)).toBeNull();
    const foreignScope = cardActivationScopeKey(
      session({ customerId: "customer-foreign" }),
      "SANDBOX",
      "/api",
      card(),
      2,
      1,
    );
    syncCardActivationScope(gate, foreignScope);
    expect(acceptsCardActivationCompletion(gate, first!, foreignScope)).toBeFalse();
    expect(settleCardActivation(gate, first!, foreignScope)).toBeFalse();
    syncCardActivationScope(gate, null);
    expect(acceptsCardActivationCompletion(gate, first!, null)).toBeFalse();
  });

  it("allows exactly one explicit same-key recovery, then blocks until a real Card refresh", () => {
    const scope = cardActivationScopeKey(session(), "SANDBOX", "/api", card(), 1, 1)!;
    const gate = createCardActivationGate(scope);
    const first = beginCardActivation(gate, scope, () => keys[0]!)!;
    expect(retainCardActivationRetry(gate, first, scope)).toBeTrue();
    expect(settleCardActivation(gate, first, scope)).toBeTrue();
    const retry = beginCardActivation(gate, scope, () => {
      throw new Error("retry must reuse the original key");
    })!;
    expect(retry.retry).toBeTrue();
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retainCardActivationRetry(gate, retry, scope)).toBeFalse();
    expect(blockCardActivation(gate, retry, scope)).toBeTrue();
    expect(settleCardActivation(gate, retry, scope)).toBeTrue();
    expect(beginCardActivation(gate, scope, () => keys[1]!)).toBeNull();

    const refreshedScope = cardActivationScopeKey(session(), "SANDBOX", "/api", card(), 1, 2)!;
    const refreshed = beginCardActivation(gate, refreshedScope, () => keys[1]!);
    expect(refreshed?.retry).toBeFalse();
    expect(refreshed?.idempotencyKey).toBe(keys[1]);
  });

  it("classifies only transport, 408, 409 and 5xx as ambiguous; 401 stays authoritative", () => {
    expect(cardActivationFailureIsAmbiguous(new TypeError("network"))).toBeTrue();
    for (const status of [0, 408, 409, 500, 503, 599]) {
      expect(cardActivationFailureIsAmbiguous({ status })).toBeTrue();
    }
    for (const status of [400, 401, 403, 404, 422, 600]) {
      expect(cardActivationFailureIsAmbiguous({ status })).toBeFalse();
    }
    expect(cardActivationFailureIsExplicit401({ status: 401 })).toBeTrue();
    expect(cardActivationFailureIsExplicit401({ status: 409 })).toBeFalse();
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "status", {
      get: () => {
        throw new Error("hostile getter");
      },
    });
    expect(cardActivationFailureIsAmbiguous(hostile)).toBeFalse();
    expect(cardActivationFailureIsExplicit401(hostile)).toBeFalse();
  });
});
