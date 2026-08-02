import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import { useHomeWalletBalances } from "./use-home-wallet-balances";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useHomeWalletBalances>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const configuredEnvironment =
  backendRuntime.error === null &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Home Wallet balance test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(): "SANDBOX" | "TEST" {
  return environment() === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-home-balance",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-home-balance",
    customerId: "customer-home-balance",
    environment: environment(),
    ...overrides,
  };
}

function account(assetCode = "USD", availableBalance = "100") {
  return {
    assetCode,
    availableBalance,
    ledgerBalance: availableBalance,
    pendingBalance: "0",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-safe" },
  });
}

function balanceResponse(items = [account()]): Response {
  return jsonResponse({ items });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function installFetch(
  responder: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return responder(input, init);
  }) as typeof globalThis.fetch;
  return calls;
}

function Harness({ currentSession }: { currentSession: BackendSession | null }) {
  latest = useHomeWalletBalances(currentSession);
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession | null = session()) {
  await act(async () => {
    renderer = create(createElement(Harness, { currentSession }));
    await flush();
  });
}

async function update(currentSession: BackendSession | null) {
  await act(async () => {
    renderer?.update(createElement(Harness, { currentSession }));
    await flush();
  });
}

async function unmount() {
  if (!renderer) return;
  await act(async () => {
    renderer?.unmount();
    await flush();
  });
  renderer = null;
  latest = null;
}

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  Date.now = originalDateNow;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Mounted Home Wallet balance binding (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("uses one same-origin public GET with browser-managed HttpOnly credentials", async () => {
      const calls = installFetch(() => balanceResponse());
      await mount();

      expect(calls).toHaveLength(1);
      const call = calls[0];
      const headers = new Headers(call?.init?.headers);
      expect(String(call?.input)).toBe("/api/v1/wallet/balances");
      expect(call?.init?.method ?? "GET").toBe("GET");
      expect(call?.init?.credentials).toBe("include");
      expect(call?.init?.cache).toBe("no-store");
      expect(call?.init?.body).toBeUndefined();
      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("Authorization")).toBeNull();
      expect(headers.get("Cookie")).toBeNull();
      expect(headers.get("X-CSRF-Token")).toBeNull();
      expect(latest?.accounts).toEqual([account()]);
      expect(JSON.stringify(latest?.accounts)).not.toMatch(/tenant-|customer-|trace-|provider-/);
    });

    it("performs no read for logout, mismatched environment or expired Session", async () => {
      const calls = installFetch(() => balanceResponse());
      for (const denied of [
        null,
        session({ environment: alternateEnvironment() }),
        session({ expiresAt: "2020-08-01T00:00:00.000Z" }),
      ]) {
        await mount(denied);
        expect(calls).toHaveLength(0);
        await unmount();
      }
    });

    it("clears the current snapshot on 4xx, malformed or oversized responses", async () => {
      for (const status of [400, 401, 403, 404, 409, 422]) {
        let reads = 0;
        installFetch(() => {
          reads += 1;
          return reads === 1
            ? balanceResponse()
            : jsonResponse({ message: `provider-secret-${status}` }, status);
        });
        await mount();
        await act(async () => {
          latest?.refresh();
          await flush();
        });
        expect(latest?.accounts, String(status)).toEqual([]);
        expect(latest?.error, String(status)).toBe("Wallet balances are unavailable");
        expect(JSON.stringify(latest), String(status)).not.toContain(`provider-secret-${status}`);
        await unmount();
      }

      for (const invalid of [
        jsonResponse({ items: [{ ...account(), providerReference: "provider-secret-shape" }] }),
        new Response(`{"items":[],"padding":"${"x".repeat(33_000)}"}`, { status: 200 }),
      ]) {
        let reads = 0;
        installFetch(() => {
          reads += 1;
          return reads === 1 ? balanceResponse() : invalid;
        });
        await mount();
        await act(async () => {
          latest?.refresh();
          await flush();
        });
        expect(latest?.accounts).toEqual([]);
        expect(latest?.error).toBe("Wallet balances are unavailable");
        expect(JSON.stringify(latest)).not.toContain("provider-secret-shape");
        await unmount();
      }
    });

    it("retains a verified snapshot only for network ambiguity, 408 and 5xx refresh failures", async () => {
      const failures: Array<number | "network"> = ["network", 408, 500, 503, 599];
      for (const failure of failures) {
        let reads = 0;
        installFetch(() => {
          reads += 1;
          if (reads === 1) return balanceResponse();
          if (failure === "network") throw new Error("provider-network-secret");
          return jsonResponse({ message: `provider-secret-${failure}` }, failure);
        });
        await mount();
        await act(async () => {
          latest?.refresh();
          await flush();
        });
        expect(latest?.accounts, String(failure)).toEqual([account()]);
        expect(latest?.error, String(failure)).toBeNull();
        expect(latest?.refreshError, String(failure)).toBe("Wallet balance refresh failed");
        expect(JSON.stringify(latest), String(failure)).not.toContain("provider-");
        await unmount();
      }
    });

    it("aborts an equal-valued replacement Session and ignores the old 401", async () => {
      const stale = deferred<Response>();
      const current = deferred<Response>();
      let reads = 0;
      const calls = installFetch(() => {
        reads += 1;
        if (reads === 1) return balanceResponse();
        if (reads === 2) return stale.promise;
        return current.promise;
      });
      const firstSession = session();
      await mount(firstSession);
      await act(async () => {
        latest?.refresh();
        await flush();
      });

      const replacementSession = session();
      expect(replacementSession).not.toBe(firstSession);
      await update(replacementSession);
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      expect(latest?.accounts).toEqual([]);
      await act(async () => {
        current.resolve(balanceResponse([account("EUR", "75")]));
        await current.promise;
        await flush();
      });
      expect(latest?.accounts[0]?.assetCode).toBe("EUR");
      await act(async () => {
        stale.resolve(jsonResponse({ message: "stale-401-secret" }, 401));
        await stale.promise;
        await flush();
      });
      expect(latest?.accounts[0]?.assetCode).toBe("EUR");
      expect(latest?.error).toBeNull();
      expect(JSON.stringify(latest)).not.toContain("stale-401-secret");
    });

    it("blocks duplicate refreshes and rejects logout, unmount and expiry-time writes", async () => {
      let reads = 0;
      const refreshPending = deferred<Response>();
      const calls = installFetch(() => {
        reads += 1;
        return reads === 1 ? balanceResponse() : refreshPending.promise;
      });
      await mount();
      await act(async () => {
        latest?.refresh();
        latest?.refresh();
        await flush();
      });
      expect(calls).toHaveLength(2);
      await update(null);
      expect(calls[1]?.init?.signal?.aborted).toBeTrue();
      expect(latest?.accounts).toEqual([]);
      await unmount();

      const expiry = Date.parse("2099-08-01T00:00:00.000Z");
      let now = expiry - 1;
      Date.now = () => now;
      const expired = deferred<Response>();
      installFetch(() => expired.promise);
      await mount(session({ expiresAt: "2099-08-01T00:00:00.000Z" }));
      now = expiry;
      await act(async () => {
        expired.resolve(balanceResponse([account("USD", "999")]));
        await expired.promise;
        await flush();
      });
      expect(latest?.accounts).toEqual([]);
      expect(JSON.stringify(latest)).not.toContain("999");
      await unmount();
    });
  },
);
