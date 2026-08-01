import { afterEach, describe, expect, it } from "bun:test";
import {
  backendApi,
  backendRuntime,
  buildCardTransactionDetailPath,
  normalizeCardTransactionDetailResponse,
  type BackendSession,
  type FastLinkEnvironment,
} from "./backend-api";

const originalFetch = globalThis.fetch;
const wireDetail = {
  id: "transaction:owned.1",
  status: "SETTLED",
  amountMinor: "2500",
  authorizedAmountMinor: "2500",
  clearedAmountMinor: "2500",
  settledAmountMinor: "2500",
  reversedAmountMinor: "0",
  refundedAmountMinor: "0",
  currency: "USD",
  traceId: "trace-public-detail",
  merchantName: "Coffee",
  merchantCategory: "5812",
  occurredAt: "2026-08-01T00:00:00.000Z",
};
const expectation = {
  cardId: "card:owned.1",
  transactionId: wireDetail.id,
  currency: wireDetail.currency,
  occurredAt: wireDetail.occurredAt,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Card transaction detail refresh adversarial boundary", () => {
  it("builds only the immutable selected Card and transaction GET path", () => {
    expect(buildCardTransactionDetailPath("card:owned.1", "transaction:owned.1")).toBe(
      "/v1/cards/card%3Aowned.1/transactions/transaction%3Aowned.1",
    );
    for (const hostile of ["", "x", "../other", "record/other", " ", "x".repeat(129)]) {
      expect(() => buildCardTransactionDetailPath(hostile, wireDetail.id)).toThrow();
      expect(() => buildCardTransactionDetailPath(expectation.cardId, hostile)).toThrow();
    }
  });

  it("accepts exactly 13 fields and never exposes trace or amount-ledger internals", () => {
    expect(Object.keys(wireDetail)).toHaveLength(13);
    const detail = normalizeCardTransactionDetailResponse(JSON.stringify(wireDetail), expectation);
    expect(detail).toEqual({
      id: wireDetail.id,
      status: "settled",
      amountMinor: "2500",
      currency: "USD",
      merchant: "Coffee",
      category: "5812",
      timestamp: wireDetail.occurredAt,
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /trace-public-detail|authorizedAmountMinor|clearedAmountMinor|settledAmountMinor/,
    );
  });

  it("fails closed on internal fields, malformed signed-64 values and partial records", () => {
    for (const hostile of [
      { ...wireDetail, providerPayload: "provider-secret" },
      { ...wireDetail, tenantId: "tenant-secret" },
      { ...wireDetail, journalIds: ["journal-secret"] },
      { ...wireDetail, amountMinor: "9223372036854775808" },
      { ...wireDetail, authorizedAmountMinor: "2.5" },
      Object.fromEntries(Object.entries(wireDetail).filter(([key]) => key !== "traceId")),
    ]) {
      expect(() =>
        normalizeCardTransactionDetailResponse(JSON.stringify(hostile), expectation),
      ).toThrow();
    }
  });

  it("rejects wrong IDs and same-ID cross-record substitutions", () => {
    for (const hostile of [
      { ...wireDetail, id: "transaction:other" },
      { ...wireDetail, currency: "EUR" },
      { ...wireDetail, occurredAt: "2026-08-01T00:00:01.000Z" },
    ]) {
      expect(() =>
        normalizeCardTransactionDetailResponse(JSON.stringify(hostile), expectation),
      ).toThrow();
    }
  });

  it("rejects mismatched, expired and production sessions before transport", async () => {
    let transports = 0;
    globalThis.fetch = (async () => {
      transports += 1;
      return new Response(JSON.stringify(wireDetail));
    }) as unknown as typeof globalThis.fetch;
    const base: BackendSession = {
      actorId: "actor-card-detail",
      tenantId: "tenant-card-detail",
      customerId: "customer-card-detail",
      environment: backendRuntime.environment ?? "SANDBOX",
      expiresAt: "2099-08-01T00:00:00.000Z",
    };
    const forbidden: BackendSession[] = [
      { ...base, environment: "UAT" },
      { ...base, environment: "PRODUCTION" },
      { ...base, environment: "UNKNOWN" as FastLinkEnvironment },
      {
        ...base,
        environment: backendRuntime.environment === "SANDBOX" ? "TEST" : "SANDBOX",
      },
      { ...base, expiresAt: "2020-01-01T00:00:00.000Z" },
    ];
    for (const currentSession of forbidden) {
      await expect(backendApi.cardTransactionDetail(currentSession, expectation)).rejects.toThrow();
    }
    expect(transports).toBe(0);
  });
});
