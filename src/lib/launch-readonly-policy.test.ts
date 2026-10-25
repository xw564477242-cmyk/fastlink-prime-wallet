import { describe, expect, it } from "bun:test";
import {
  launchRequestAllowed,
  launchRouteAllowed,
  safeCardFailure,
  supportReference,
} from "./launch-readonly-policy.b1";
describe("B1 read-only boundary", () => {
  it("allows only login lifecycle and paged persisted Card list", () => {
    for (const path of ["/v1/auth/login", "/v1/auth/refresh", "/v1/auth/logout"])
      expect(launchRequestAllowed(path, "POST")).toBe(true);
    for (const path of ["/v1/session", "/v1/cards", "/v1/cards?limit=20&cursor=abc%2Fdef"])
      expect(launchRequestAllowed(path)).toBe(true);
  });
  it("blocks writes, registration, provider reads, funds and URL tricks", () => {
    for (const path of [
      "/v1/auth/register",
      "/v1/cards/virtual",
      "/v1/cards/id/freeze",
      "/v1/cards/id/balance",
      "/v1/cards/id/transactions",
      "/v1/wallet/accounts",
      "https://evil/v1/cards",
      "/v1/cards?tenantId=other",
      "/v1/cards/../wallet",
    ]) {
      expect(launchRequestAllowed(path)).toBe(false);
      expect(launchRequestAllowed(path, "POST")).toBe(false);
    }
    expect(launchRequestAllowed("/v1/cards", "DELETE")).toBe(false);
    expect(launchRouteAllowed("/transfer")).toBe(false);
  });
  it("never includes backend payload or secret in error disclosure", () => {
    const text = safeCardFailure({
      status: 503,
      traceId: "trace-123456",
      message: "password and provider token",
    });
    expect(text).toContain("trace-123456");
    expect(text).not.toContain("password");
    expect(safeCardFailure({ status: 408, traceId: "<script>" })).toContain("unavailable");
    expect(safeCardFailure({ status: 401 })).toContain("重新登录");
  });
  it("produces an exact non-authoritative cross-app reference", () => {
    expect(JSON.parse(supportReference("tenant-1", "TEST", "trace-123456"))).toEqual({
      version: 1,
      tenantId: "tenant-1",
      environment: "TEST",
      traceId: "trace-123456",
    });
    expect(() => supportReference("tenant-1", "PRODUCTION", "trace-123456")).toThrow();
  });
});
