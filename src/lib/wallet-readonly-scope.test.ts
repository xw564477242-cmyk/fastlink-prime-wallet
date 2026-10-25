import { describe, expect, it } from "bun:test";
import {
  previewRequestAllowed,
  previewBrowserRequestAllowed,
} from "../launch/preview-readonly-policy";
import { normalizeCardListResponse } from "./backend-api";
import { launchRequestAllowed, isWalletOnlyPreview } from "./launch-readonly-policy";
describe("wallet-only preview request increment", () => {
  it("represents absent preview balance as unavailable, preserving the ordinary SDK default", () => {
    const oldM = process.env.VITE_FASTLINK_PREVIEW_MODE,
      oldS = process.env.VITE_FASTLINK_PREVIEW_SCOPE;
    const page = {
      cards: [
        {
          id: "card_A",
          type: "VIRTUAL",
          status: "PENDING",
          last4: "0000",
          expiryMonth: 12,
          expiryYear: 2030,
          currency: "USD",
        },
      ],
      nextCursor: null,
    };
    try {
      process.env.VITE_FASTLINK_PREVIEW_MODE = "READ_ONLY";
      process.env.VITE_FASTLINK_PREVIEW_SCOPE = "WALLET_ONLY";
      const c = normalizeCardListResponse(page).cards[0];
      expect(Number.isNaN(c.balance)).toBe(true);
      expect(c.availableBalanceMinor).toBeUndefined();
      delete process.env.VITE_FASTLINK_PREVIEW_SCOPE;
      expect(normalizeCardListResponse(page).cards[0].balance).toBe(0);
    } finally {
      if (oldM === undefined) delete process.env.VITE_FASTLINK_PREVIEW_MODE;
      else process.env.VITE_FASTLINK_PREVIEW_MODE = oldM;
      if (oldS === undefined) delete process.env.VITE_FASTLINK_PREVIEW_SCOPE;
      else process.env.VITE_FASTLINK_PREVIEW_SCOPE = oldS;
    }
  });
  it("permits session, cards and approved wallet reads, with only authentication mutations", () => {
    for (const p of [
      "/api/v1/session",
      "/api/v1/cards?limit=20",
      "/api/v1/cards/card_A",
      "/api/v1/wallet/assets",
      "/api/v1/wallet/balances",
      "/api/v1/wallet/transactions?assetCode=USD&limit=25",
      "/api/v1/wallet/transactions/tx_A",
    ])
      expect(previewRequestAllowed(p, "GET", "WALLET_ONLY")).toBe(true);
    for (const a of ["login", "refresh", "logout"])
      expect(previewRequestAllowed("/api/v1/auth/" + a, "POST", "WALLET_ONLY")).toBe(true);
  });
  it("refuses non-core reads, mutations, tenant query injection and unknown scope", () => {
    for (const p of [
      "/api/v1/cards/card_A/balance",
      "/api/v1/cards/card_A/limits",
      "/api/v1/cards/card_A/timeline",
      "/api/v1/cards/card_A/transactions",
      "/api/v1/wallet/accounts",
      "/api/v1/wallet/accounts/account_A/transactions?assetCode=USD",
      "/api/v1/wallet/operations",
      "/api/v1/wallet/operations/operation_A",
      "/api/admin/users",
      "/api/v1/cards?tenantId=other",
      "/api/v1/wallet/balances?tenantId=other",
      "/api/v1/wallet/transactions?assetCode=USD&customerId=other",
      "/api/v1/wallet/transactions/tx_A?environment=TEST",
      "/api/v1/wallet/transactions",
      "/api/v1/wallet/transactions?assetCode=USD&assetCode=EUR",
    ])
      expect(previewRequestAllowed(p, "GET", "WALLET_ONLY")).toBe(false);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      for (const p of [
        "/api/v1/wallet/balances",
        "/api/v1/wallet/transactions/tx_A",
        "/api/v1/wallet/transfers",
        "/api/v1/wallet/fx/quotes",
      ])
        expect(previewRequestAllowed(p, method, "WALLET_ONLY")).toBe(false);
    expect(previewRequestAllowed("/api/v1/cards/virtual", "POST", "WALLET_ONLY")).toBe(false);
    expect(previewRequestAllowed("/api/v1/auth/register", "POST", "WALLET_ONLY")).toBe(false);
    expect(previewRequestAllowed("/api/v1/session", "GET", "OTHER")).toBe(false);
  });
  it("passes the same narrow scope through the browser transport", () => {
    const prev = {
      mode: process.env.VITE_FASTLINK_PREVIEW_MODE,
      scope: process.env.VITE_FASTLINK_PREVIEW_SCOPE,
    };
    try {
      process.env.VITE_FASTLINK_PREVIEW_MODE = "READ_ONLY";
      process.env.VITE_FASTLINK_PREVIEW_SCOPE = "WALLET_ONLY";
      expect(isWalletOnlyPreview()).toBe(true);
      expect(launchRequestAllowed("/v1/cards/card_A")).toBe(true);
      for (const p of [
        "/v1/wallet/assets",
        "/v1/wallet/balances",
        "/v1/wallet/transactions?assetCode=USD&limit=25",
        "/v1/wallet/transactions/tx_A",
      ]) {
        expect(launchRequestAllowed(p)).toBe(true);
        expect(previewBrowserRequestAllowed(p, "GET", "WALLET_ONLY")).toBe(true);
      }
      expect(launchRequestAllowed("/v1/wallet/accounts")).toBe(false);
      expect(
        previewBrowserRequestAllowed(
          "/v1/wallet/transactions?assetCode=USD&tenantId=other",
          "GET",
          "WALLET_ONLY",
        ),
      ).toBe(false);
      expect(previewBrowserRequestAllowed("/v1/wallet/transfers", "POST", "WALLET_ONLY")).toBe(
        false,
      );
      expect(previewBrowserRequestAllowed("/v1/cards/card_A", "GET", "WALLET_ONLY")).toBe(true);
    } finally {
      for (const [k, v] of Object.entries({
        VITE_FASTLINK_PREVIEW_MODE: prev.mode,
        VITE_FASTLINK_PREVIEW_SCOPE: prev.scope,
      }))
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
  });
});
