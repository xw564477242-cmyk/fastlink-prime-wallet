import { describe, expect, it } from "bun:test";
import {
  buildCardStatusMutationRequest,
  normalizeCardStatusMutationResponse,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";
import {
  acceptsCardStatusMutationCompletion,
  beginCardStatusMutation,
  blockCardStatusMutation,
  cardStatusMutationFailureIsAmbiguous,
  cardStatusMutationFailureIsExplicit401,
  cardStatusMutationScopeKey,
  createCardStatusMutationGate,
  retainCardStatusMutationRetry,
  settleCardStatusMutation,
  syncCardStatusMutationScope,
} from "./card-status-mutation-state";

const keys = ["a0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-9000-000000000002"];

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-status-a",
  expiresAt: "2099-08-01T00:00:00.000Z",
  tenantId: "tenant-status-a",
  customerId: "customer-status-a",
  environment: "SANDBOX",
  ...overrides,
});

const card = (overrides: Partial<WalletCard> = {}): WalletCard => ({
  cardId: "card:owned.status",
  type: "virtual",
  status: "active",
  last4: "4242",
  expiry: "12/30",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Owned Status Card",
  balance: 25,
  availableBalanceMinor: "2500",
  createdAt: "2026-01-01T00:00:00Z",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: false,
    renew: false,
    updateLimits: true,
  },
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  id: "card:owned.status",
  type: "VIRTUAL",
  status: "FROZEN",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Owned Status Card",
  availableBalanceMinor: "2500",
  createdAt: "2026-01-01T00:00:00Z",
  capabilities: {
    freeze: false,
    unfreeze: true,
    replace: false,
    renew: false,
    updateLimits: true,
  },
  ...overrides,
});

describe("Selected Card status mutation environment and scope", () => {
  it("allows only matching unexpired SANDBOX/TEST sessions and a legal selected Card action", () => {
    expect(cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze")).not.toBeNull();
    expect(
      cardStatusMutationScopeKey(
        session({ environment: "TEST" }),
        "TEST",
        card({
          status: "frozen",
          capabilities: { ...card().capabilities, freeze: false, unfreeze: true },
        }),
        "unfreeze",
      ),
    ).not.toBeNull();
    for (const environment of ["LOCAL", "UAT", "PRODUCTION"] as FastLinkEnvironment[]) {
      expect(
        cardStatusMutationScopeKey(session({ environment }), environment, card(), "freeze"),
      ).toBeNull();
    }
    expect(cardStatusMutationScopeKey(session(), "TEST", card(), "freeze")).toBeNull();
    expect(
      cardStatusMutationScopeKey(
        session({ expiresAt: "2020-01-01T00:00:00Z" }),
        "SANDBOX",
        card(),
        "freeze",
      ),
    ).toBeNull();
    expect(cardStatusMutationScopeKey(session(), "SANDBOX", card(), "unfreeze")).toBeNull();
    expect(
      cardStatusMutationScopeKey(
        session(),
        "SANDBOX",
        card({ capabilities: { ...card().capabilities, freeze: false } }),
        "freeze",
      ),
    ).toBeNull();
  });

  it("binds identity, expiry, tenant, customer, environment, action and every public Card version", () => {
    const scope = cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze");
    if (!scope) throw new Error("scope required");
    const changes = [
      [session({ actorId: "actor-status-b" }), card(), "freeze"],
      [session({ expiresAt: "2099-08-01T01:00:00.000Z" }), card(), "freeze"],
      [session({ tenantId: "tenant-status-b" }), card(), "freeze"],
      [session({ customerId: "customer-status-b" }), card(), "freeze"],
      [session(), card({ cardId: "card:owned.other" }), "freeze"],
      [session(), card({ last4: "5252" }), "freeze"],
      [session(), card({ alias: "Changed" }), "freeze"],
    ] as const;
    for (const [nextSession, nextCard, action] of changes) {
      expect(cardStatusMutationScopeKey(nextSession, "SANDBOX", nextCard, action)).not.toBe(scope);
    }
    expect(cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze", 1, 0)).not.toBe(
      scope,
    );
    expect(cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze", 0, 1)).not.toBe(
      scope,
    );
    const frozen = card({
      status: "frozen",
      capabilities: { ...card().capabilities, freeze: false, unfreeze: true },
    });
    expect(cardStatusMutationScopeKey(session(), "SANDBOX", frozen, "unfreeze")).not.toBe(scope);
  });
});

describe("Selected Card status mutation request and response", () => {
  it("builds one exact bodyless POST with a canonical UUIDv4 idempotency key", () => {
    const request = buildCardStatusMutationRequest(card(), "freeze", keys[0]!);
    expect(request.path).toBe("/v1/cards/card%3Aowned.status/freeze");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBeUndefined();
    expect(new Headers(request.init.headers).get("Idempotency-Key")).toBe(keys[0]);
    expect(Object.keys(request.init).sort()).toEqual(["headers", "method"]);
  });

  it("requires the same Card and exact action transition while exposing only public fields", () => {
    const normalized = normalizeCardStatusMutationResponse(
      { ...response(), providerOperationId: "provider-secret", traceId: "trace-secret" },
      card(),
      "freeze",
    );
    expect(normalized.status).toBe("frozen");
    expect(normalized.cardId).toBe(card().cardId);
    expect(JSON.stringify(normalized)).not.toMatch(/provider|trace-secret/);
    for (const mutation of [
      { id: "card:foreign" },
      { status: "ACTIVE" },
      { last4: "9999" },
      { currency: "EUR" },
      { capabilities: { ...response().capabilities, freeze: true } },
    ]) {
      expect(() =>
        normalizeCardStatusMutationResponse(response(mutation), card(), "freeze"),
      ).toThrow();
    }
  });
});

describe("Selected Card status mutation duplicate and stale completion isolation", () => {
  it("synchronously locks duplicates and rejects old action/session/Card/unmount completions", () => {
    const scope = cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze");
    if (!scope) throw new Error("scope required");
    const gate = createCardStatusMutationGate(scope);
    let keyIndex = 0;
    const first = beginCardStatusMutation(gate, scope, "freeze", () => keys[keyIndex++]!);
    const duplicate = beginCardStatusMutation(gate, scope, "freeze", () => keys[keyIndex++]!);
    expect(first?.idempotencyKey).toBe(keys[0]);
    expect(duplicate).toBeNull();

    const frozen = card({
      status: "frozen",
      capabilities: { ...card().capabilities, freeze: false, unfreeze: true },
    });
    const unfreezeScope = cardStatusMutationScopeKey(session(), "SANDBOX", frozen, "unfreeze");
    syncCardStatusMutationScope(gate, unfreezeScope);
    expect(acceptsCardStatusMutationCompletion(gate, first!, unfreezeScope)).toBeFalse();
    expect(settleCardStatusMutation(gate, first!, unfreezeScope)).toBeFalse();

    if (!unfreezeScope) throw new Error("unfreeze scope required");
    const second = beginCardStatusMutation(
      gate,
      unfreezeScope,
      "unfreeze",
      () => keys[keyIndex++]!,
    );
    expect(second?.idempotencyKey).toBe(keys[1]);
    syncCardStatusMutationScope(gate, null);
    expect(acceptsCardStatusMutationCompletion(gate, second!, null)).toBeFalse();
  });

  it("allows exactly one explicit same-key retry before blocking the unchanged Card scope", () => {
    const scope = cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze", 3, 5);
    if (!scope) throw new Error("scope required");
    const gate = createCardStatusMutationGate(scope);
    const first = beginCardStatusMutation(gate, scope, "freeze", () => keys[0]!);
    if (!first) throw new Error("first ticket required");
    expect(first.retry).toBeFalse();
    expect(retainCardStatusMutationRetry(gate, first, scope)).toBeTrue();
    expect(settleCardStatusMutation(gate, first, scope)).toBeTrue();

    const retry = beginCardStatusMutation(gate, scope, "freeze", () => {
      throw new Error("retry must not create a new idempotency key");
    });
    if (!retry) throw new Error("retry ticket required");
    expect(retry.retry).toBeTrue();
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retainCardStatusMutationRetry(gate, retry, scope)).toBeFalse();
    expect(blockCardStatusMutation(gate, retry, scope)).toBeTrue();
    expect(settleCardStatusMutation(gate, retry, scope)).toBeTrue();
    expect(beginCardStatusMutation(gate, scope, "freeze", () => keys[1]!)).toBeNull();

    const refreshedScope = cardStatusMutationScopeKey(session(), "SANDBOX", card(), "freeze", 3, 6);
    if (!refreshedScope) throw new Error("refreshed scope required");
    const refreshed = beginCardStatusMutation(gate, refreshedScope, "freeze", () => keys[1]!);
    expect(refreshed?.idempotencyKey).toBe(keys[1]);
    expect(refreshed?.retry).toBeFalse();
  });

  it("classifies only transport, timeout, 409 and server outcomes as ambiguous", () => {
    expect(cardStatusMutationFailureIsAmbiguous(new TypeError("network unavailable"))).toBeTrue();
    expect(cardStatusMutationFailureIsAmbiguous(new Error("local validation failed"))).toBeFalse();
    for (const status of [0, 408, 409, 500, 503, 599]) {
      expect(cardStatusMutationFailureIsAmbiguous({ status })).toBeTrue();
    }
    for (const status of [400, 401, 403, 404, 422, 600]) {
      expect(cardStatusMutationFailureIsAmbiguous({ status })).toBeFalse();
    }
    expect(cardStatusMutationFailureIsExplicit401({ status: 401 })).toBeTrue();
    expect(cardStatusMutationFailureIsExplicit401({ status: 409 })).toBeFalse();
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "status", {
      get: () => {
        throw new Error("getter");
      },
    });
    expect(cardStatusMutationFailureIsAmbiguous(hostile)).toBeFalse();
    expect(cardStatusMutationFailureIsExplicit401(hostile)).toBeFalse();
  });
});
