import { describe, expect, it } from "bun:test";
import type { BackendSession, WalletCardTransaction } from "./backend-api";
import {
  cardTransactionDetailErrorMessage,
  cardTransactionDetailReducer,
  cardTransactionDetailRequestKey,
  cardTransactionDetailScopeKey,
  cardTransactionDetailViewForScope,
  cardTransactionPublicVersion,
  initialCardTransactionDetailState,
} from "./card-transaction-detail-state";

const session: BackendSession = {
  actorId: "actor-card-detail",
  expiresAt: "2099-08-01T00:00:00.000Z",
  tenantId: "tenant-card-detail",
  customerId: "customer-card-detail",
  environment: "SANDBOX",
};

const detail: WalletCardTransaction = {
  id: "transaction:detail.1",
  status: "settled",
  amountMinor: "2500",
  currency: "USD",
  merchant: "Coffee",
  category: "5812",
  timestamp: "2026-08-01T00:00:00.000Z",
};

function scope(
  currentSession: BackendSession | null = session,
  transaction: WalletCardTransaction | null = detail,
  cardId = "card:owned.1",
  filter: "ALL" | "SETTLED" = "ALL",
  historyScope = "history-scope-v1",
) {
  return cardTransactionDetailScopeKey(currentSession, cardId, filter, transaction, historyScope);
}

describe("Card transaction detail state", () => {
  it("binds the live session, Card, filter, list scope and complete public snapshot", () => {
    const base = scope();
    expect(base).not.toBeNull();
    for (const changed of [
      { ...session, actorId: "actor-other" },
      { ...session, expiresAt: "2099-08-02T00:00:00.000Z" },
      { ...session, tenantId: "tenant-other" },
      { ...session, customerId: "customer-other" },
      { ...session, environment: "TEST" as const },
    ]) {
      expect(scope(changed)).not.toBe(base);
    }
    expect(scope(session, detail, "card:owned.2")).not.toBe(base);
    expect(scope(session, detail, "card:owned.1", "SETTLED")).not.toBe(base);
    expect(scope(session, detail, "card:owned.1", "ALL", "history-scope-v2")).not.toBe(base);
    for (const changed of [
      { ...detail, id: "transaction:detail.2" },
      { ...detail, status: "cleared" as const },
      { ...detail, amountMinor: "2600" },
      { ...detail, currency: "EUR" },
      { ...detail, merchant: "Other" },
      { ...detail, category: "5999" },
      { ...detail, timestamp: "2026-08-01T00:00:01.000Z" },
    ]) {
      expect(scope(session, changed)).not.toBe(base);
    }
    expect(JSON.parse(cardTransactionPublicVersion(detail))).toHaveLength(7);
  });

  it("keeps the last verified detail through refresh failure and replaces it atomically", () => {
    const currentScope = scope()!;
    const firstRequest = cardTransactionDetailRequestKey(currentScope, 1);
    const secondRequest = cardTransactionDetailRequestKey(currentScope, 2);
    const reset = cardTransactionDetailReducer(initialCardTransactionDetailState, {
      type: "reset",
      scopeKey: currentScope,
    });
    const firstLoading = cardTransactionDetailReducer(reset, {
      type: "begin",
      scopeKey: currentScope,
      requestKey: firstRequest,
    });
    const verified = cardTransactionDetailReducer(firstLoading, {
      type: "loaded",
      requestKey: firstRequest,
      detail,
    });
    const refreshing = cardTransactionDetailReducer(verified, {
      type: "begin",
      scopeKey: currentScope,
      requestKey: secondRequest,
    });
    expect(refreshing.detail).toEqual(detail);
    const failed = cardTransactionDetailReducer(refreshing, {
      type: "failed",
      requestKey: secondRequest,
      message: "Card transaction detail is unavailable",
    });
    expect(failed.detail).toEqual(detail);

    const replacement = { ...detail, status: "cleared" as const, amountMinor: "2600" };
    const loaded = cardTransactionDetailReducer(refreshing, {
      type: "loaded",
      requestKey: secondRequest,
      detail: replacement,
    });
    expect(loaded.detail).toEqual(replacement);
  });

  it("ignores every stale generation completion and hides data immediately on scope change", () => {
    const currentScope = scope()!;
    const currentRequest = cardTransactionDetailRequestKey(currentScope, 3);
    const staleRequest = cardTransactionDetailRequestKey(currentScope, 2);
    const current = cardTransactionDetailReducer(
      cardTransactionDetailReducer(initialCardTransactionDetailState, {
        type: "reset",
        scopeKey: currentScope,
      }),
      { type: "begin", scopeKey: currentScope, requestKey: currentRequest },
    );
    expect(
      cardTransactionDetailReducer(current, {
        type: "loaded",
        requestKey: staleRequest,
        detail,
      }),
    ).toBe(current);
    expect(
      cardTransactionDetailReducer(current, {
        type: "failed",
        requestKey: staleRequest,
        message: "stale",
      }),
    ).toBe(current);
    expect(
      cardTransactionDetailReducer(current, { type: "settled", requestKey: staleRequest }),
    ).toBe(current);
    expect(
      cardTransactionDetailViewForScope({ ...current, detail }, "scope-other").detail,
    ).toBeNull();
  });

  it("uses one bounded error for transport, provider and record failures", () => {
    for (const reason of [new Error("provider secret"), new Error("wrong id"), null]) {
      expect(cardTransactionDetailErrorMessage(reason)).toBe(
        "Card transaction detail is unavailable",
      );
    }
  });
});
