import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import { useWalletOperations } from "./use-wallet-operations";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Result = ReturnType<typeof useWalletOperations>;
const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
let renderer: ReactTestRenderer | null = null;
let result: Result | null = null;

const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;
const describeEnvironment = configuredEnvironment ? describe : describe.skip;

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  if (!configuredEnvironment) throw new Error("mounted environment required");
  return {
    actorId: "actor-wallet-operation",
    tenantId: "tenant-wallet-operation",
    customerId: "customer-wallet-operation",
    environment: configuredEnvironment,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function operation(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    type: "DEPOSIT",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25.5",
    direction: "INCOMING",
    createdAt: "2026-08-01T00:59:00.000Z",
    completedAt: "2026-08-01T00:59:01.000Z",
    updatedAt: "2026-08-01T00:59:01.000Z",
    ...patch,
  };
}

function page(items: unknown[], nextCursor: string | null = null) {
  return new Response(JSON.stringify({ items, nextCursor }), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "wallet-operation-test" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness({ currentSession }: { currentSession: BackendSession | null }) {
  result = useWalletOperations(currentSession);
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(async () => {
  Date.now = originalDateNow;
  if (renderer) {
    await act(async () => {
      renderer?.unmount();
      await flush();
    });
  }
  renderer = null;
  result = null;
  globalThis.fetch = originalFetch;
});

describeEnvironment(
  `Wallet operation filters and refresh (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("binds type/status filters to one GET and rejects cross-filter rows", async () => {
      const calls: string[] = [];
      globalThis.fetch = (async (input) => {
        const url = new URL(String(input), "https://wallet.invalid");
        calls.push(url.toString());
        if (url.searchParams.get("type") === "DEPOSIT") {
          return page([operation("operation-filtered")]);
        }
        return page([]);
      }) as typeof fetch;
      const currentSession = session();
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession }));
        await flush();
      });
      await act(async () => {
        result?.changeFilters({ type: "DEPOSIT", status: "COMPLETED" });
        await flush();
      });
      expect(calls).toHaveLength(2);
      const filtered = new URL(calls[1]!);
      expect(Object.fromEntries(filtered.searchParams)).toEqual({
        limit: "25",
        type: "DEPOSIT",
        status: "COMPLETED",
      });
      expect(result?.items.map((item) => item.id)).toEqual(["operation-filtered"]);

      globalThis.fetch = (async () =>
        page([
          operation("operation-cross-filter", { type: "WITHDRAWAL" }),
        ])) as unknown as typeof fetch;
      await act(async () => {
        result?.refresh();
        await flush();
      });
      expect(result?.items.map((item) => item.id)).toEqual(["operation-filtered"]);
      expect(result?.refreshError).toBe("Wallet activity refresh failed");
    });

    it("keeps the verified snapshot during one manual refresh and rejects natural expiry", async () => {
      const pending = deferred<Response>();
      let reads = 0;
      globalThis.fetch = (async () => {
        reads += 1;
        return reads === 1 ? page([operation("operation-current")]) : pending.promise;
      }) as unknown as typeof fetch;
      const currentSession = session();
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession }));
        await flush();
      });
      await act(async () => {
        result?.refresh();
        await flush();
      });
      expect(result?.items.map((item) => item.id)).toEqual(["operation-current"]);
      expect(result?.refreshing).toBe(true);
      Date.now = () => Date.parse(currentSession.expiresAt!) + 1;
      await act(async () => {
        pending.resolve(page([operation("operation-expired")]));
        await flush();
      });
      expect(reads).toBe(2);
      expect(result?.items.map((item) => item.id)).toEqual(["operation-current"]);
      expect(result?.refreshError).toBe("Wallet activity refresh failed");
    });

    it("aborts and zero-writes old tenant/customer/session scope and unmounted work", async () => {
      const old = deferred<Response>();
      const signals: AbortSignal[] = [];
      globalThis.fetch = (async (_input, init) => {
        if (init?.signal) signals.push(init.signal);
        return old.promise;
      }) as typeof fetch;
      const first = session();
      await act(async () => {
        renderer = create(createElement(Harness, { currentSession: first }));
        await flush();
      });
      await act(async () => {
        renderer?.update(
          createElement(Harness, {
            currentSession: session({ tenantId: "tenant-next", customerId: "customer-next" }),
          }),
        );
        await flush();
      });
      expect(signals[0]?.aborted).toBe(true);
      await act(async () => {
        renderer?.unmount();
        await flush();
      });
      expect(signals.at(-1)?.aborted).toBe(true);
      await act(async () => {
        old.resolve(page([operation("operation-stale-secret")]));
        await flush();
      });
      expect(JSON.stringify(result)).not.toContain("operation-stale-secret");
      renderer = null;
    });
  },
);
