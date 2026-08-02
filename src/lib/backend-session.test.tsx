import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "./backend-api";
import { BackendSessionProvider, useBackendSession } from "./backend-session";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type SessionContext = ReturnType<typeof useBackendSession>;
type FetchHandler = (path: string, init?: RequestInit) => Response | Promise<Response>;

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let latest: SessionContext | null = null;

const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;
const describeEnvironment = configuredEnvironment ? describe : describe.skip;

function session(label: string, overrides: Partial<BackendSession> = {}): BackendSession {
  if (!configuredEnvironment) throw new Error("mounted environment required");
  return {
    actorId: `actor-${label}`,
    tenantId: `tenant-${label}`,
    customerId: `customer-${label}`,
    environment: configuredEnvironment,
    expiresAt: "2100-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": `session-${status}` },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness() {
  latest = useBackendSession();
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(handler: FetchHandler) {
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input), "https://wallet.invalid").pathname;
    return handler(path, init);
  }) as typeof fetch;
  await act(async () => {
    renderer = create(createElement(BackendSessionProvider, null, createElement(Harness)));
    await flush();
  });
}

async function rejectRefresh() {
  let caught: unknown;
  await act(async () => {
    try {
      await latest?.refresh();
    } catch (reason) {
      caught = reason;
    }
    await flush();
  });
  expect(caught).toBeInstanceOf(Error);
}

afterEach(async () => {
  if (renderer) {
    await act(async () => {
      renderer?.unmount();
      await flush();
    });
  }
  renderer = null;
  latest = null;
  globalThis.fetch = originalFetch;
});

describeEnvironment(
  `Canonical Backend session Provider (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("ignores a late transient startup check after a newer login commits", async () => {
      const startup = deferred<Response>();
      const loggedIn = session("logged-in");
      await mount((path) => {
        if (path.endsWith("/v1/session")) return startup.promise;
        if (path.endsWith("/v1/auth/login")) return response(loggedIn);
        throw new Error(`Unexpected request ${path}`);
      });
      await act(async () => {
        await latest?.connect(
          { tenantId: "tenant-login", email: "user@example.test", password: "not-a-secret" },
          "login",
        );
        await flush();
      });
      expect(latest?.session).toEqual(loggedIn);
      expect(latest?.checking).toBe(false);

      await act(async () => {
        startup.resolve(response({ message: "startup unavailable" }, 503));
        await flush();
      });
      expect(latest?.session).toEqual(loggedIn);
      expect(latest?.error).toBeNull();
    });

    it("allows only the latest refresh, connect or disconnect epoch to commit", async () => {
      const active = session("active");
      const refreshedLate = session("refreshed-late");
      const connected = session("connected");
      const reconnected = session("reconnected");
      const refresh = deferred<Response>();
      const logout = deferred<Response>();
      let loginCount = 0;
      await mount((path) => {
        if (path.endsWith("/v1/session")) return response(active);
        if (path.endsWith("/v1/auth/refresh")) return refresh.promise;
        if (path.endsWith("/v1/auth/logout")) return logout.promise;
        if (path.endsWith("/v1/auth/login")) {
          loginCount += 1;
          return response(loginCount === 1 ? connected : reconnected);
        }
        throw new Error(`Unexpected request ${path}`);
      });
      expect(latest?.session).toEqual(active);

      let oldRefresh!: Promise<void>;
      await act(async () => {
        oldRefresh = latest!.refresh();
        await flush();
      });
      await act(async () => {
        await latest?.connect(
          { tenantId: "tenant-connected", email: "user@example.test", password: "not-a-secret" },
          "login",
        );
        await flush();
      });
      await act(async () => {
        refresh.resolve(response(refreshedLate));
        await oldRefresh;
        await flush();
      });
      expect(latest?.session).toEqual(connected);

      let oldDisconnect!: Promise<void>;
      await act(async () => {
        oldDisconnect = latest!.disconnect();
        await flush();
      });
      await act(async () => {
        await latest?.connect(
          { tenantId: "tenant-reconnected", email: "user@example.test", password: "not-a-secret" },
          "login",
        );
        await flush();
      });
      await act(async () => {
        logout.resolve(response(null));
        await oldDisconnect;
        await flush();
      });
      expect(latest?.session).toEqual(reconnected);
    });

    it("retains the current Session for transient and module failures, then clears on 401", async () => {
      const active = session("retained");
      const refreshResponses = [408, 429, 500, 503, 599, "MODULE_FAILURE", 401] as const;
      let refreshIndex = 0;
      await mount((path) => {
        if (path.endsWith("/v1/session")) return response(active);
        if (path.endsWith("/v1/auth/refresh")) {
          const next = refreshResponses[refreshIndex++];
          return next === "MODULE_FAILURE" ? response(null) : response({ message: "safe" }, next);
        }
        throw new Error(`Unexpected request ${path}`);
      });
      for (const ignored of refreshResponses.slice(0, -1)) {
        void ignored;
        await rejectRefresh();
        expect(latest?.session).toEqual(active);
      }
      await rejectRefresh();
      expect(latest?.session).toBeNull();
    });

    for (const mode of ["expiry", "environment mismatch"] as const) {
      it(`clears the current Session for authoritative ${mode}`, async () => {
        const active = session("authority-active");
        const invalid =
          mode === "expiry"
            ? session("expired", { expiresAt: "2000-01-01T00:00:00.000Z" })
            : session("mismatch", {
                environment: configuredEnvironment === "SANDBOX" ? "TEST" : "SANDBOX",
              });
        await mount((path) => {
          if (path.endsWith("/v1/session")) return response(active);
          if (path.endsWith("/v1/auth/refresh")) return response(invalid);
          throw new Error(`Unexpected request ${path}`);
        });
        await rejectRefresh();
        expect(latest?.session).toBeNull();
      });
    }
  },
);
