import { afterEach, expect, it } from "bun:test";
import { backendApi, BackendApiError, backendRuntime, type BackendSession } from "./backend-api";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const session: BackendSession = {
  actorId: "actor",
  tenantId: "tenant",
  customerId: "customer",
  environment: backendRuntime.environment!,
  expiresAt: "2100-01-01T00:00:00.000Z",
};
it("preserves HTTP/code/trace without changing cookie, no-store and same-origin requests", async () => {
  let path = "";
  let init: RequestInit | undefined;
  globalThis.fetch = (async (url: string, options?: RequestInit) => {
    path = url;
    init = options;
    return new Response(JSON.stringify({ code: "DATABASE_UNAVAILABLE", message: "private" }), {
      status: 503,
      headers: { "x-trace-id": "test-trace" },
    });
  }) as unknown as typeof fetch;
  const error = await backendApi.walletAssets(session).catch((e) => e);
  expect(error).toBeInstanceOf(BackendApiError);
  expect(error.status).toBe(503);
  expect(error.code).toBe("DATABASE_UNAVAILABLE");
  expect(error.traceId).toBe("test-trace");
  expect(path).toBe("/api/v1/wallet/assets");
  expect(init?.credentials).toBe("include");
  expect(init?.cache).toBe("no-store");
});
it("distinguishes caller cancellation from an actual request timeout", async () => {
  globalThis.fetch = (async (_url: string, options: RequestInit) =>
    new Promise((_resolve, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("cancelled", "AbortError")),
        { once: true },
      );
    })) as unknown as typeof fetch;
  const controller = new AbortController();
  const request = backendApi.walletAssets(session, controller.signal).catch((e) => e);
  controller.abort();
  const error = await request;
  expect(error.status).toBe(408);
  expect(error.cancelled).toBe(true);
});
