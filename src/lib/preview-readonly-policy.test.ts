import { describe, expect, it } from "bun:test";
import { launchRequestAllowed } from "./launch-readonly-policy";

function withPreviewMode(mode: string | undefined, check: () => void) {
  const previous = process.env.VITE_FASTLINK_PREVIEW_MODE;
  try {
    if (mode === undefined) delete process.env.VITE_FASTLINK_PREVIEW_MODE;
    else process.env.VITE_FASTLINK_PREVIEW_MODE = mode;
    check();
  } finally {
    if (previous === undefined) delete process.env.VITE_FASTLINK_PREVIEW_MODE;
    else process.env.VITE_FASTLINK_PREVIEW_MODE = previous;
  }
}

describe("B13 preview restriction on the existing B10 wallet contract", () => {
  it("allows the approved wallet and Card persisted reads in explicit preview mode", () => {
    withPreviewMode("READ_ONLY", () => {
      for (const target of [
        "/v1/session",
        "/v1/wallet/assets",
        "/v1/wallet/balances",
        "/v1/wallet/accounts",
        "/v1/wallet/transactions?assetCode=USD&limit=20",
        "/v1/cards/owned-card/transactions?limit=20",
      ]) {
        expect(launchRequestAllowed(target, "GET")).toBe(true);
      }
      for (const target of ["/v1/auth/login", "/v1/auth/refresh", "/v1/auth/logout"]) {
        expect(launchRequestAllowed(target, "POST")).toBe(true);
      }
    });
  });
  it("rejects registration, business writes and non-wallet entry points in preview mode", () => {
    withPreviewMode("READ_ONLY", () => {
      for (const target of [
        "/v1/auth/register",
        "/v1/cards/virtual",
        "/v1/wallet/transfers",
        "/v1/kyc/submissions",
        "/admin/auth/login",
      ]) {
        expect(launchRequestAllowed(target, "POST")).toBe(false);
      }
      expect(launchRequestAllowed("/v1/cards/owned-card", "DELETE")).toBe(false);
    });
  });
  it("preserves the existing non-preview B10 contract", () => {
    withPreviewMode(undefined, () => {
      expect(launchRequestAllowed("/v1/auth/register", "POST")).toBe(true);
      expect(launchRequestAllowed("/v1/wallet/accounts", "GET")).toBe(true);
      expect(launchRequestAllowed("/v1/cards/virtual", "POST")).toBe(false);
    });
  });
});
