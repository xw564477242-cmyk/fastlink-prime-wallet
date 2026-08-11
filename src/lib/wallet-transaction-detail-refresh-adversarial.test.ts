import { afterEach, describe, expect, it } from "bun:test";
import {
  backendApi,
  backendRuntime,
  buildWalletTransactionDetailPath,
  normalizeWalletTransactionDetail,
  type BackendSession,
  type FastLinkEnvironment,
} from "./backend-api";

const originalFetch = globalThis.fetch;
const wireDetail = {
  id: "wallet-txn-refresh-1",
  operationId: "operation-refresh-1",
  cardId: "card-refresh-1",
  cardType: "VIRTUAL",
  type: "TRANSFER",
  status: "COMPLETED",
  assetCode: "USD",
  amount: "25.5",
  direction: "OUTGOING",
  createdAt: "2026-07-31T12:00:00.000Z",
  updatedAt: "2026-07-31T12:00:01.000Z",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Wallet transaction detail refresh adversarial boundary", () => {
  it("uses only the immutable public detail GET path", () => {
    expect(buildWalletTransactionDetailPath("wallet-txn:refresh.1")).toBe(
      "/v1/wallet/transactions/wallet-txn%3Arefresh.1",
    );
  });

  it("returns exactly eleven public fields and strips all internal additions", () => {
    const detail = normalizeWalletTransactionDetail(
      {
        ...wireDetail,
        tenantId: "tenant-secret",
        customerId: "customer-secret",
        walletAccountId: "account-secret",
        journalIds: ["journal-secret"],
        providerPayload: "provider-secret",
      },
      { transactionId: wireDetail.id, assetCode: "USD", amount: "25.5" },
    );
    expect(Object.keys(detail).sort()).toEqual([
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
    expect(JSON.stringify(detail)).not.toMatch(
      /tenant-secret|customer-secret|account-secret|journal-secret|provider-secret/,
    );
  });

  it("binds immutable id, selected asset and canonical amount", () => {
    expect(() =>
      normalizeWalletTransactionDetail(
        { ...wireDetail, id: "wallet-txn-other" },
        {
          transactionId: wireDetail.id,
          assetCode: "USD",
          amount: "25.5",
        },
      ),
    ).toThrow("different Wallet transaction id");
    expect(() =>
      normalizeWalletTransactionDetail(
        { ...wireDetail, assetCode: "EUR" },
        {
          transactionId: wireDetail.id,
          assetCode: "USD",
          amount: "25.5",
        },
      ),
    ).toThrow("outside the selected account");
    expect(() =>
      normalizeWalletTransactionDetail(
        { ...wireDetail, amount: "25.6" },
        {
          transactionId: wireDetail.id,
          assetCode: "USD",
          amount: "25.5",
        },
      ),
    ).toThrow("inconsistent Wallet transaction amount");
  });

  it("rejects forbidden or expired sessions before any transport", async () => {
    let transports = 0;
    globalThis.fetch = (async () => {
      transports += 1;
      return new Response(JSON.stringify(wireDetail));
    }) as unknown as typeof fetch;
    const base: BackendSession = {
      actorId: "actor-wallet-detail-refresh",
      tenantId: "tenant-wallet-detail-refresh",
      customerId: "customer-wallet-detail-refresh",
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
        backendApi.walletTransactionDetail(currentSession, {
          transactionId: wireDetail.id,
          assetCode: "USD",
          amount: "25.5",
        }),
      ).rejects.toThrow();
    }
    expect(transports).toBe(0);
  });
});
