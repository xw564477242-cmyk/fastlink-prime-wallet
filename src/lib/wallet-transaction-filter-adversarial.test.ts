import { afterEach, describe, expect, it } from "bun:test";
import { createHash, createHmac } from "node:crypto";
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
const cursorPayload = Buffer.from(
  JSON.stringify({
    version: 1,
    createdAt: "2026-07-31T12:00:00.000Z",
    id: "wallet-txn-1",
    type: null,
    status: null,
    assetCode: "USD",
  }),
).toString("base64url");
const cursorKey = createHash("sha256")
  .update("fastlink-wallet-transaction-cursor\0test-only-signing-secret-0123456789", "utf8")
  .digest();
const signedCursor = `${cursorPayload}.${createHmac("sha256", cursorKey)
  .update(
    JSON.stringify({
      tenantId: "tenant-01",
      customerId: "customer-01",
      environment: "SANDBOX",
      limit: 25,
      encoded: cursorPayload,
    }),
  )
  .digest("base64url")}`;

const transactionRecord = () => ({
  id: "wallet-txn-1",
  operationId: "operation-1",
  cardId: "card-1",
  cardType: "VIRTUAL",
  type: "TRANSFER",
  status: "COMPLETED",
  assetCode: "USD",
  amount: "25.5",
  direction: "OUTGOING",
  createdAt: "2026-07-31T12:00:00.000Z",
  updatedAt: "2026-07-31T12:00:01.000Z",
});

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

  it("forwards only one exact payload.mac cursor and accepts the same response shape", () => {
    expect(buildWalletTransactionPath({ assetCode: "USD", limit: 25, cursor: signedCursor })).toBe(
      `/v1/wallet/transactions?assetCode=USD&limit=25&cursor=${signedCursor}`,
    );
    expect(
      normalizeWalletTransactionResponse(
        { items: [transactionRecord()], nextCursor: signedCursor },
        "USD",
      ).nextCursor,
    ).toBe(signedCursor);

    const invalidCursors: unknown[] = [
      "",
      "payload",
      ".signature",
      "payload.",
      "payload..signature",
      "payload.signature.extra",
      "payload+bad.signature",
      "payload.signature=",
      "AB.AA",
      "AA.AB",
      "payload.signature",
      `${"a".repeat(255)}.AA`,
      `${"a".repeat(255)}.${"b".repeat(257)}`,
      1,
    ];
    for (const cursor of invalidCursors) {
      expect(() =>
        buildWalletTransactionPath({
          assetCode: "USD",
          limit: 25,
          cursor: cursor as string,
        }),
      ).toThrow("Invalid Wallet transaction cursor");
      expect(() =>
        normalizeWalletTransactionResponse(
          { items: [transactionRecord()], nextCursor: cursor },
          "USD",
        ),
      ).toThrow("invalid Wallet transaction cursor");
    }
    expect(() =>
      buildWalletTransactionPath({ assetCode: "USD", limit: 25, cursor: null as never }),
    ).toThrow("Invalid Wallet transaction cursor");
    expect(
      normalizeWalletTransactionResponse({ items: [transactionRecord()], nextCursor: null }, "USD")
        .nextCursor,
    ).toBeNull();
    const maximumCursor = `${"a".repeat(254)}A.${"b".repeat(256)}`;
    expect(
      buildWalletTransactionPath({ assetCode: "USD", limit: 25, cursor: maximumCursor }),
    ).toContain(`cursor=${maximumCursor}`);
  });

  it("emits only the eleven public transaction fields", () => {
    const page = normalizeWalletTransactionResponse(
      {
        items: [
          {
            ...transactionRecord(),
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
      "cardId",
      "cardType",
      "createdAt",
      "direction",
      "id",
      "operationId",
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
          operationId: "operation-filter-1",
          cardId: "card-filter-1",
          cardType: "VIRTUAL",
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
