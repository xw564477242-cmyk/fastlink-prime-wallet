import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import { useWalletTransferAccounts } from "./use-wallet-transfer-accounts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useWalletTransferAccounts>;
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
    throw new Error("Wallet transfer account safety test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-transfer-accounts",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-transfer-accounts",
    customerId: "customer-transfer-accounts",
    environment: environment(),
    ...overrides,
  };
}

function accountWire(id = "account-source-01", availableBalance = "100") {
  return {
    id,
    accountCode: "CUSTOMER:USD",
    name: "Customer USD",
    assetCode: "USD",
    status: "ACTIVE",
    currentBalance: availableBalance,
    postedBalance: availableBalance,
    pendingBalance: "0",
    availableBalance,
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-safe" },
  });
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
  latest = useWalletTransferAccounts(currentSession);
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
  `Mounted Wallet transfer account refresh safety (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("uses same-origin GET /api with browser-managed HttpOnly credentials and exposes only public fields", async () => {
      const calls = installFetch(() => jsonResponse([accountWire()]));
      await mount();

      expect(calls).toHaveLength(1);
      const call = calls[0];
      const headers = new Headers(call?.init?.headers);
      expect(String(call?.input)).toBe("/api/v1/wallet/accounts");
      expect(call?.init?.method ?? "GET").toBe("GET");
      expect(call?.init?.credentials).toBe("include");
      expect(call?.init?.cache).toBe("no-store");
      expect(call?.init?.body).toBeUndefined();
      expect(headers.get("Accept")).toBe("application/json");
      expect(headers.get("Authorization")).toBeNull();
      expect(headers.get("Cookie")).toBeNull();
      expect(headers.get("X-CSRF-Token")).toBeNull();
      expect(latest?.accounts).toEqual([
        {
          id: "account-source-01",
          assetCode: "USD",
          status: "active",
          currentBalance: "100",
          postedBalance: "100",
          pendingBalance: "0",
          availableBalance: "100",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ]);
      expect(JSON.stringify(latest?.accounts)).not.toMatch(
        /CUSTOMER:USD|Customer USD|tenant-|customer-/,
      );
    });

    it("fails closed for 4xx and malformed responses without exposing raw error details", async () => {
      for (const status of [400, 401, 403, 404, 409, 422]) {
        let reads = 0;
        installFetch(() => {
          reads += 1;
          return reads === 1
            ? jsonResponse([accountWire()])
            : jsonResponse({ message: `provider-secret-${status}` }, status);
        });
        await mount();
        expect(latest?.accounts).toHaveLength(1);
        await act(async () => {
          latest?.refresh();
          await flush();
        });
        expect(latest?.accounts, String(status)).toEqual([]);
        expect(latest?.error, String(status)).toBe("Wallet accounts are unavailable");
        expect(JSON.stringify(latest), String(status)).not.toContain(`provider-secret-${status}`);
        await unmount();
      }

      let reads = 0;
      installFetch(() => {
        reads += 1;
        return reads === 1
          ? jsonResponse([accountWire()])
          : jsonResponse([{ ...accountWire(), providerReference: "provider-secret-shape" }]);
      });
      await mount();
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(latest?.accounts).toEqual([]);
      expect(latest?.error).toBe("Wallet accounts are unavailable");
      expect(JSON.stringify(latest)).not.toContain("provider-secret-shape");
    });

    it("retains a validated snapshot only for network ambiguity, 408 and 5xx", async () => {
      const failures: Array<number | "network"> = ["network", 408, 500, 503, 599];
      for (const failure of failures) {
        let reads = 0;
        installFetch(() => {
          reads += 1;
          if (reads === 1) return jsonResponse([accountWire()]);
          if (failure === "network") throw new Error("provider-network-secret");
          return jsonResponse({ message: `provider-secret-${failure}` }, failure);
        });
        await mount();
        await act(async () => {
          latest?.refresh();
          await flush();
        });
        expect(latest?.accounts, String(failure)).toHaveLength(1);
        expect(latest?.error, String(failure)).toBe("Wallet accounts are unavailable");
        expect(JSON.stringify(latest), String(failure)).not.toContain("provider-");
        await unmount();
      }
    });

    it("aborts an equal-valued replacement Session and ignores the old 401 without clearing the new scope", async () => {
      const stale = deferred<Response>();
      const current = deferred<Response>();
      let reads = 0;
      const calls = installFetch(() => {
        reads += 1;
        if (reads === 1) return jsonResponse([accountWire()]);
        if (reads === 2) return stale.promise;
        return current.promise;
      });
      const firstSession = session();
      await mount(firstSession);
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls[1]?.init?.signal?.aborted).toBe(false);

      const replacementSession = session();
      expect(replacementSession).not.toBe(firstSession);
      await update(replacementSession);
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      expect(latest?.accounts).toEqual([]);

      await act(async () => {
        current.resolve(jsonResponse([accountWire("account-current-02", "75")]));
        await current.promise;
        await flush();
      });
      expect(latest?.accounts[0]?.id).toBe("account-current-02");

      await act(async () => {
        stale.resolve(jsonResponse({ message: "stale-401-secret" }, 401));
        await stale.promise;
        await flush();
      });
      expect(latest?.accounts[0]?.id).toBe("account-current-02");
      expect(latest?.error).toBeNull();
      expect(JSON.stringify(latest)).not.toContain("stale-401-secret");
    });

    it("actively aborts on logout and unmount, blocks duplicate refreshes and rejects expiry-time writes", async () => {
      const initial = deferred<Response>();
      const calls = installFetch(() => initial.promise);
      await mount();
      expect(calls).toHaveLength(1);
      await update(null);
      expect(calls[0]?.init?.signal?.aborted).toBe(true);
      expect(latest?.accounts).toEqual([]);
      await unmount();

      let reads = 0;
      const refreshPending = deferred<Response>();
      const duplicateCalls = installFetch(() => {
        reads += 1;
        return reads === 1 ? jsonResponse([accountWire()]) : refreshPending.promise;
      });
      await mount();
      await act(async () => {
        latest?.refresh();
        latest?.refresh();
        await flush();
      });
      expect(duplicateCalls).toHaveLength(2);
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(duplicateCalls).toHaveLength(2);
      await unmount();
      expect(duplicateCalls[1]?.init?.signal?.aborted).toBe(true);

      const expiry = Date.parse("2099-08-01T00:00:00.000Z");
      let now = expiry - 1;
      Date.now = () => now;
      const expired = deferred<Response>();
      installFetch(() => expired.promise);
      await mount(session({ expiresAt: "2099-08-01T00:00:00.000Z" }));
      now = expiry;
      await act(async () => {
        expired.resolve(jsonResponse([accountWire("account-expired-secret")]));
        await expired.promise;
        await flush();
      });
      expect(latest?.accounts).toEqual([]);
      expect(latest?.error).toBeNull();
      expect(JSON.stringify(latest)).not.toContain("account-expired-secret");
    });
  },
);
