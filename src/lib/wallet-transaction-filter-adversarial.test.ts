import { afterEach, describe, expect, it } from "bun:test";
import {
  backendApi,
  backendRuntime,
  buildWalletTransactionPath,
  normalizeWalletTransactionResponse,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletAccountTransactionQuery,
} from "./backend-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Wallet transaction filter adversarial boundary", () => {
  it("accepts only the Backend public type/status closed sets", () => {
    expect(
      buildWalletTransactionPath({
        assetCode: "USDT",
        type: "MERCHANT_PAYMENT",
        status: "REVERSED",
        limit: 25,
      }),
    ).toBe("/v1/wallet/transactions?assetCode=USDT&limit=25&type=MERCHANT_PAYMENT&status=REVERSED");
    for (const query of [
      { assetCode: "USD", type: "merchant_payment" },
      { assetCode: "USD", type: "CARD_PAYMENT" },
      { assetCode: "USD", status: "SETTLED" },
      { assetCode: "USD", status: "completed" },
    ]) {
      expect(() => buildWalletTransactionPath(query as WalletAccountTransactionQuery)).toThrow();
    }
  });

  it("emits only the eight public transaction fields", () => {
    const page = normalizeWalletTransactionResponse(
      {
        items: [
          {
            id: "wallet-txn-1",
            type: "TRANSFER",
            status: "COMPLETED",
            assetCode: "USD",
            amount: "25.5",
            direction: "OUTGOING",
            createdAt: "2026-07-31T12:00:00.000Z",
            updatedAt: "2026-07-31T12:00:01.000Z",
            tenantId: "tenant-secret",
            customerId: "customer-secret",
            walletAccountId: "account-secret",
            providerPayload: "provider-secret",
          },
        ],
        nextCursor: null,
      },
      "USD",
    );
    expect(Object.keys(page.items[0]).sort()).toEqual([
      "amount",
      "assetCode",
      "createdAt",
      "direction",
      "id",
      "status",
      "type",
      "updatedAt",
    ]);
    expect(JSON.stringify(page)).not.toMatch(
      /tenant-secret|customer-secret|account-secret|provider-secret/,
    );
  });

  it("rejects otherwise valid rows that escape the selected filter", () => {
    const value = {
      items: [
        {
          id: "wallet-txn-filter-1",
          type: "TRANSFER",
          status: "COMPLETED",
          assetCode: "USD",
          amount: "25.5",
          direction: "OUTGOING",
          createdAt: "2026-07-31T12:00:00.000Z",
          updatedAt: "2026-07-31T12:00:01.000Z",
        },
      ],
      nextCursor: null,
    };
    expect(() => normalizeWalletTransactionResponse(value, "USD", 25, { type: "DEPOSIT" })).toThrow(
      "outside the selected type filter",
    );
    expect(() =>
      normalizeWalletTransactionResponse(value, "USD", 25, { status: "PENDING" }),
    ).toThrow("outside the selected status filter");
  });

  it("fails before transport for UAT, PRODUCTION, unknown, mismatched or expired sessions", async () => {
    let transports = 0;
    globalThis.fetch = (async () => {
      transports += 1;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const base: BackendSession = {
      actorId: "actor-wallet-filter",
      tenantId: "tenant-wallet-filter",
      customerId: "customer-wallet-filter",
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
      await expect(
        backendApi.walletTransactions(currentSession, { assetCode: "USD", limit: 25 }),
      ).rejects.toThrow();
    }
    expect(transports).toBe(0);
  });
});
