import { afterAll, describe, expect, it } from "bun:test";
import { backendApi } from "./backend-api";
import {
  clientRequestAllowed,
  resolveClientMode,
  safeCardFailure,
  supportReference,
} from "./launch-readonly-policy";

const keys = [
  "VITE_FASTLINK_API_URL",
  "VITE_FASTLINK_ENVIRONMENT",
  "VITE_FASTLINK_PRODUCT_MODE",
  "VITE_FASTLINK_PREVIEW_MODE",
  "VITE_FASTLINK_CANDIDATE_ID",
  "FASTLINK_PREVIEW_BUILD",
] as const;
const initial = new Map(keys.map((key) => [key, process.env[key]] as const));
const initialFetch = globalThis.fetch;
const runtime = { apiUrl: "/api", environment: "SANDBOX" };
const preview = {
  ...runtime,
  productMode: "READ_ONLY_PREVIEW",
  previewMode: "READ_ONLY",
  candidateId: "FL-LAUNCH-B13-20261017",
  previewBuild: true,
};

async function withBindings(
  overrides: Partial<Record<(typeof keys)[number], string | undefined>>,
  check: () => void | Promise<void>,
) {
  const previous = new Map(keys.map((key) => [key, process.env[key]] as const));
  const previousFetch = globalThis.fetch;
  try {
    for (const key of keys) delete process.env[key];
    process.env.VITE_FASTLINK_API_URL = "/api";
    process.env.VITE_FASTLINK_ENVIRONMENT = "SANDBOX";
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await check();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previousFetch;
  }
}

afterAll(() => {
  for (const key of keys) expect(process.env[key]).toBe(initial.get(key));
  expect(globalThis.fetch).toBe(initialFetch);
});

describe("Real SDK context and explicit read-only product mode", () => {
  it("separates legacy SDK, B10 product and fully bound compiled preview", () => {
    for (const environment of ["SANDBOX", "TEST"]) {
      expect(resolveClientMode({ ...runtime, environment })).toBe("SDK_CONTRACT");
      expect(resolveClientMode({ ...runtime, environment, productMode: "SDK_CONTRACT" })).toBe(
        "SDK_CONTRACT",
      );
      expect(resolveClientMode({ ...runtime, environment, productMode: "B10_READ_ONLY" })).toBe(
        "B10_READ_ONLY",
      );
      expect(resolveClientMode({ ...preview, environment })).toBe("READ_ONLY_PREVIEW");
    }
  });

  it("fails closed when a compiled preview loses or conflicts with any binding", () => {
    for (const field of ["productMode", "previewMode", "candidateId"] as const) {
      expect(resolveClientMode({ ...preview, [field]: undefined })).toBe("BLOCKED");
    }
    for (const input of [
      { ...preview, productMode: "SDK_CONTRACT" },
      { ...preview, productMode: "B10_READ_ONLY" },
      { ...preview, candidateId: "unknown-candidate" },
      { ...preview, previewMode: "DISABLED" },
      { ...preview, previewBuild: "true" },
      { ...runtime, productMode: "UNKNOWN" },
      { ...runtime, candidateId: "FL-LAUNCH-B13-20261017" },
    ]) {
      expect(resolveClientMode(input)).toBe("BLOCKED");
    }
  });

  it("rejects production, UAT, missing identity and off-origin runtime in all modes", () => {
    for (const environment of [undefined, "", "PRODUCTION", "UAT", "LOCAL", "UNKNOWN"]) {
      expect(resolveClientMode({ ...runtime, environment })).toBe("BLOCKED");
      expect(resolveClientMode({ ...preview, environment })).toBe("BLOCKED");
    }
    for (const apiUrl of [undefined, "", "https://backend.invalid/api", "//backend.invalid/api"]) {
      expect(resolveClientMode({ ...runtime, apiUrl })).toBe("BLOCKED");
      expect(resolveClientMode({ ...preview, apiUrl })).toBe("BLOCKED");
    }
  });

  it("restores existing GET and POST SDK contracts only to synthetic fetch in both environments", async () => {
    for (const environment of ["SANDBOX", "TEST"]) {
      await withBindings({ VITE_FASTLINK_ENVIRONMENT: environment }, async () => {
        const requests: Array<{ target: string; method: string }> = [];
        globalThis.fetch = (async (input, init) => {
          requests.push({ target: String(input), method: init?.method ?? "GET" });
          return Response.json({ synthetic: true });
        }) as typeof fetch;
        await backendApi.session();
        await backendApi.register({
          tenantId: "synthetic-tenant",
          email: "synthetic@example.invalid",
          password: "synthetic-only-not-an-account",
        });
        expect(requests).toEqual([
          { target: "/api/v1/session", method: "GET" },
          { target: "/api/v1/auth/register", method: "POST" },
        ]);
        expect(clientRequestAllowed("/v1/cards/card%3Aowned.1/timeline?limit=25", "GET")).toBe(
          true,
        );
        expect(clientRequestAllowed("/v1/wallet/transfers", "POST")).toBe(true);
        for (const status of [401, 403, 503]) {
          expect(
            safeCardFailure({
              status,
              traceId: "trace-selection-secret-must-not-render",
              message: "internal-selection-secret-must-not-render",
            }),
          ).toBe("Card list is unavailable");
        }
        for (const target of [
          "/v1/cards?limit=20",
          "/v1/cards/card%3Aowned.1",
          "/v1/cards/card%3Aowned.1/balance",
          "/v1/cards/card%3Aowned.1/limits",
          "/v1/cards/card%3Aowned.1/transactions?limit=20",
          "/v1/cards/card%3Aowned.1/transactions/transaction%3A1",
          "/v1/wallet/assets",
          "/v1/wallet/balances",
          "/v1/wallet/accounts",
          "/v1/wallet/transactions?assetCode=USD",
          "/v1/wallet/accounts/account%3A1/transactions?assetCode=USD",
          "/v1/wallet/transactions/transaction%3A1",
          "/v1/wallet/operations?limit=20",
          "/v1/wallet/operations/operation%3A1",
        ])
          expect(clientRequestAllowed(target, "GET")).toBe(true);
        for (const target of [
          "/v1/auth/login",
          "/v1/auth/refresh",
          "/v1/auth/logout",
          "/v1/cards/virtual",
          "/v1/cards/card%3Aowned.1/activate",
          "/v1/cards/card%3Aowned.1/renew",
          "/v1/cards/card%3Aowned.1/replace",
          "/v1/cards/card%3Aowned.1/freeze",
          "/v1/cards/card%3Aowned.1/unfreeze",
          "/v1/cards/card%3Aowned.1/limits",
          "/v1/wallet/fx/quotes",
        ])
          expect(clientRequestAllowed(target, "POST")).toBe(true);
      });
    }
  });

  it("retains preview business denials in the same SDK before fetch", async () => {
    await withBindings(
      {
        VITE_FASTLINK_PRODUCT_MODE: "READ_ONLY_PREVIEW",
        VITE_FASTLINK_PREVIEW_MODE: "READ_ONLY",
        VITE_FASTLINK_CANDIDATE_ID: "FL-LAUNCH-B13-20261017",
      },
      async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (input) => {
          requests.push(String(input));
          return Response.json({ synthetic: true });
        }) as typeof fetch;
        await backendApi.session();
        await expect(
          backendApi.register({
            tenantId: "synthetic",
            email: "s@example.invalid",
            password: "synthetic",
          }),
        ).rejects.toThrow("只读");
        for (const target of [
          "/v1/cards/virtual",
          "/v1/cards/owned/activate",
          "/v1/cards/owned/renew",
          "/v1/cards/owned/replace",
          "/v1/cards/owned/freeze",
          "/v1/cards/owned/limits",
          "/v1/wallet/transfers",
        ]) {
          expect(clientRequestAllowed(target, "POST")).toBe(false);
        }
        expect(clientRequestAllowed("/v1/cards/card%3Aowned.1/timeline?limit=25", "GET")).toBe(
          false,
        );
        expect(requests).toEqual(["/api/v1/session"]);
        expect(
          safeCardFailure({
            status: 503,
            traceId: "trace-preview-123",
            message: "internal-selection-secret-must-not-render",
          }),
        ).toBe("卡查询不可用，请联系客服 · HTTP 503 · Trace trace-preview-123");
      },
    );
    await withBindings({ VITE_FASTLINK_PRODUCT_MODE: "B10_READ_ONLY" }, () => {
      expect(safeCardFailure({ status: 408, traceId: "trace-product-123" })).toBe(
        "查询超时，请稍后手动刷新 · HTTP 408 · Trace trace-product-123",
      );
      expect(JSON.parse(supportReference("tenant-1", "TEST", "trace-product-123"))).toEqual({
        version: 1,
        tenantId: "tenant-1",
        environment: "TEST",
        traceId: "trace-product-123",
      });
    });
  });

  it("blocks unknown or incomplete runtime through the actual SDK before any fetch", async () => {
    for (const overrides of [
      { VITE_FASTLINK_PRODUCT_MODE: "UNKNOWN" },
      { VITE_FASTLINK_ENVIRONMENT: "PRODUCTION" },
      { VITE_FASTLINK_API_URL: "https://backend.invalid/api" },
      { VITE_FASTLINK_CANDIDATE_ID: "FL-LAUNCH-B13-20261017" },
      { VITE_FASTLINK_PREVIEW_MODE: "READ_ONLY" },
      { FASTLINK_PREVIEW_BUILD: "true" },
    ]) {
      await withBindings(overrides, async () => {
        let calls = 0;
        globalThis.fetch = (async () => {
          calls += 1;
          return Response.json({ synthetic: true });
        }) as unknown as typeof fetch;
        await expect(backendApi.session()).rejects.toThrow();
        expect(calls).toBe(0);
        expect(
          safeCardFailure({
            status: 403,
            traceId: "trace-selection-secret-must-not-render",
            message: "internal-selection-secret-must-not-render",
          }),
        ).toBe("Card list is unavailable");
      });
    }
  });

  it("keeps the SDK transport guard against off-origin, encoded separators and unsupported methods", async () => {
    await withBindings({}, () => {
      for (const target of [
        "https://outside.invalid/v1/session",
        "//outside.invalid/v1/session",
        "/admin/auth/login",
        "/v1/cards/%2e%2e/session",
        "/v1/cards/owned%2fother/timeline",
        "/v1/cards/owned%5cother/timeline",
        "/v1/cards/%ZZ",
        "/v1/session#fragment",
        "/v1/unknown",
        "/v1/cards/owned/unknown",
        "/v1/wallet/unknown",
        "/v1/cards?tenantId=other",
      ]) {
        expect(clientRequestAllowed(target, "GET")).toBe(false);
      }
      expect(clientRequestAllowed("/v1/cards/owned", "DELETE")).toBe(false);
      expect(clientRequestAllowed("/v1/cards/owned", "PATCH")).toBe(false);
      expect(clientRequestAllowed("/v1/session", "POST")).toBe(false);
      expect(clientRequestAllowed("/v1/cards/virtual?tenantId=other", "POST")).toBe(false);
    });
  });
});
