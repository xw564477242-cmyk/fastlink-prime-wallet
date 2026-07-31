import { describe, expect, it } from "bun:test";
import type { BackendSession, WalletCard } from "./backend-api";
import {
  acceptsCardActionResponse,
  beginCardAction,
  cardActionAllowed,
  cardActionScopeKey,
  cardSessionScopeKey,
  createCardActionGate,
  syncCardActionScope,
  visibleCardActionState,
} from "./card-action-state";

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-a",
  tenantId: "tenant-a",
  customerId: "customer-a",
  environment: "SANDBOX",
  ...overrides,
});

const card = (overrides: Partial<WalletCard> = {}): WalletCard => ({
  cardId: "card-a",
  type: "virtual",
  status: "active",
  last4: "4242",
  expiry: "12/30",
  currency: "USD",
  balance: 10,
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: false,
    renew: false,
    updateLimits: false,
  },
  ...overrides,
});

describe("Card action state", () => {
  it("denies Card actions without a current session and enforces Card capabilities", () => {
    expect(cardActionAllowed("refresh", true, null, card())).toBeFalse();
    expect(cardActionAllowed("refresh", false, cardSessionScopeKey(session()), card())).toBeFalse();
    const active = card();
    expect(cardActionAllowed("freeze", true, cardSessionScopeKey(session()), active)).toBeTrue();
    expect(cardActionAllowed("unfreeze", true, cardSessionScopeKey(session()), active)).toBeFalse();
    expect(
      cardActionAllowed(
        "freeze",
        true,
        cardSessionScopeKey(session()),
        card({ capabilities: { ...active.capabilities, freeze: false } }),
      ),
    ).toBeFalse();

    const frozen = card({
      status: "frozen",
      capabilities: { ...active.capabilities, freeze: false, unfreeze: true },
    });
    expect(cardActionAllowed("freeze", true, cardSessionScopeKey(session()), frozen)).toBeFalse();
    expect(cardActionAllowed("unfreeze", true, cardSessionScopeKey(session()), frozen)).toBeTrue();

    for (const status of ["pending", "closed", "failed"] as const) {
      expect(
        cardActionAllowed(
          "freeze",
          true,
          cardSessionScopeKey(session()),
          card({ status, capabilities: { ...active.capabilities, freeze: true } }),
        ),
      ).toBeFalse();
    }
  });

  it("rejects late responses after actor, tenant, environment or Card changes", () => {
    const firstSession = cardSessionScopeKey(session());
    const firstScope = cardActionScopeKey(firstSession, "card-a");
    if (!firstScope) throw new Error("test scope is required");

    for (const nextScope of [
      cardActionScopeKey(cardSessionScopeKey(session({ actorId: "actor-b" })), "card-a"),
      cardActionScopeKey(cardSessionScopeKey(session({ tenantId: "tenant-b" })), "card-a"),
      cardActionScopeKey(cardSessionScopeKey(session({ environment: "UAT" })), "card-a"),
      cardActionScopeKey(firstSession, "card-b"),
      null,
    ]) {
      const gate = createCardActionGate(firstScope);
      const ticket = beginCardAction(gate, firstScope, "freeze");
      syncCardActionScope(gate, nextScope);
      expect(acceptsCardActionResponse(gate, ticket, nextScope)).toBeFalse();
    }
  });

  it("allows only the newest action generation in one Card scope", () => {
    const scope = cardActionScopeKey(cardSessionScopeKey(session()), "card-a");
    if (!scope) throw new Error("test scope is required");
    const gate = createCardActionGate(scope);
    const oldFreeze = beginCardAction(gate, scope, "freeze");
    const newRefresh = beginCardAction(gate, scope, "refresh");

    expect(acceptsCardActionResponse(gate, oldFreeze, scope)).toBeFalse();
    expect(acceptsCardActionResponse(gate, newRefresh, scope)).toBeTrue();
  });

  it("synchronously hides prior-scope busy and error state before effects", () => {
    const oldScope = cardActionScopeKey(cardSessionScopeKey(session()), "card-a");
    const nextScope = cardActionScopeKey(
      cardSessionScopeKey(session({ tenantId: "tenant-b" })),
      "card-b",
    );
    expect(
      visibleCardActionState(
        { scopeKey: oldScope, busy: true, error: "foreign Card failure" },
        nextScope,
      ),
    ).toEqual({ scopeKey: nextScope, busy: false, error: null });
  });
});
