import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import { useCardTimelinePages } from "./use-card-timeline-pages";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useCardTimelinePages>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

const originalFetch = globalThis.fetch;
const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;

const cursor = (
  id: string,
  occurredAt = "2026-08-01T00:00:00.000Z",
  kind: "LIFECYCLE" | "EVENT" = "EVENT",
) =>
  `${Buffer.from(JSON.stringify({ v: 1, t: occurredAt, k: kind, i: id })).toString("base64url")}.${Buffer.alloc(32).toString("base64url")}`;

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  if (!configuredEnvironment) throw new Error("Card timeline hook test requires SANDBOX or TEST");
  return {
    actorId: "actor-card-timeline-01",
    tenantId: "tenant-card-timeline-01",
    customerId: "customer-card-timeline-01",
    environment: configuredEnvironment,
    expiresAt: "2099-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function event(id: string, occurredAt = "2026-08-01T00:00:00.000Z") {
  return {
    id,
    type: "STATUS_CHANGED",
    fromStatus: "PENDING",
    toStatus: "ACTIVE",
    occurredAt,
  };
}

function response(events: unknown[], nextCursor: unknown, status = 200): Response {
  return new Response(JSON.stringify({ events, nextCursor }), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-card-timeline" },
  });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function Harness({
  currentSession,
  cardId,
  onInvalidate,
}: {
  currentSession: BackendSession | null;
  cardId: string | null;
  onInvalidate?: (expectedSession: BackendSession) => void;
}) {
  latest = useCardTimelinePages(currentSession, cardId, onInvalidate);
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(
  currentSession: BackendSession,
  cardId = "card:owned.1",
  onInvalidate?: (expectedSession: BackendSession) => void,
) {
  await act(async () => {
    renderer = create(createElement(Harness, { currentSession, cardId, onInvalidate }));
    await flush();
  });
}

async function update(
  currentSession: BackendSession | null,
  cardId: string | null,
  onInvalidate?: (expectedSession: BackendSession) => void,
) {
  await act(async () => {
    renderer?.update(createElement(Harness, { currentSession, cardId, onInvalidate }));
    await flush();
  });
}

async function settle(pending: Deferred<Response>, value: Response) {
  await act(async () => {
    pending.resolve(value);
    await pending.promise;
    await flush();
  });
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

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted Card timeline (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("uses one same-origin GET, limit 25, and preserves the snapshot through failed manual refresh", async () => {
      const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
      let requestCount = 0;
      globalThis.fetch = (async (input, init) => {
        calls.push({ input, init });
        requestCount += 1;
        return requestCount === 1
          ? response([event("timeline_event_01")], cursor("timeline_event_01"))
          : response([], null, 503);
      }) as typeof globalThis.fetch;

      await mount(session());
      expect(latest?.events.map(({ id }) => id)).toEqual(["timeline_event_01"]);
      const firstUrl = new URL(String(calls[0]?.input), "https://wallet.invalid");
      expect(`${firstUrl.pathname}${firstUrl.search}`).toBe(
        "/api/v1/cards/card%3Aowned.1/timeline?limit=25",
      );
      expect(calls[0]?.init?.method ?? "GET").toBe("GET");

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(latest?.events.map(({ id }) => id)).toEqual(["timeline_event_01"]);
      expect(latest?.refreshError).toBe("Card lifecycle timeline refresh failed");
      expect(latest?.scopeReady).toBeTrue();
    });

    it("aborts and ignores an old response after actor, expiry, tenant, customer, environment or Card changes", async () => {
      const old = deferred<Response>();
      let requestCount = 0;
      const signals: AbortSignal[] = [];
      globalThis.fetch = (async (_input, init) => {
        requestCount += 1;
        if (init?.signal) signals.push(init.signal);
        return requestCount === 1 ? old.promise : response([], null);
      }) as typeof globalThis.fetch;

      await mount(session());
      await update(
        session({
          actorId: "actor-card-timeline-02",
          expiresAt: "2099-08-02T00:00:00.000Z",
          tenantId: "tenant-card-timeline-02",
          customerId: "customer-card-timeline-02",
        }),
        "card:owned.2",
      );
      expect(signals[0]?.aborted).toBeTrue();
      expect(latest?.events).toEqual([]);
      await settle(
        old,
        response([event("timeline_stale_private")], cursor("timeline_stale_private")),
      );
      expect(latest?.events).toEqual([]);
      expect(JSON.stringify(latest)).not.toContain("stale_private");
    });

    it("fails closed before fetch for expired sessions and leaves no timeline mounted", async () => {
      let calls = 0;
      globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
        calls += 1;
        return response([event("must_not_load")], null);
      }) as typeof globalThis.fetch;
      await mount(session({ expiresAt: "2026-01-01T00:00:00.000Z" }));
      expect(calls).toBe(0);
      expect(latest?.events).toEqual([]);
      expect(latest?.nextCursor).toBeNull();
    });

    it("clears the current snapshot and invalidates only the matching session on 401", async () => {
      const activeSession = session();
      const invalidated: BackendSession[] = [];
      let requestCount = 0;
      globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
        requestCount += 1;
        return requestCount === 1
          ? response([event("timeline_event_01")], cursor("timeline_event_01"))
          : response([], null, 401);
      }) as typeof globalThis.fetch;

      await mount(activeSession, "card:owned.1", (expected) => invalidated.push(expected));
      await act(async () => {
        latest?.refresh();
        await flush();
      });

      expect(latest?.events).toEqual([]);
      expect(latest?.nextCursor).toBeNull();
      expect(invalidated).toEqual([activeSession]);
    });

    for (const status of [403, 404]) {
      it(`clears the current snapshot without invalidating the session on ${status}`, async () => {
        const invalidated: BackendSession[] = [];
        let requestCount = 0;
        globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
          requestCount += 1;
          return requestCount === 1
            ? response([event("timeline_event_01")], cursor("timeline_event_01"))
            : response([], null, status);
        }) as typeof globalThis.fetch;

        await mount(session(), "card:owned.1", (expected) => invalidated.push(expected));
        await act(async () => {
          latest?.refresh();
          await flush();
        });

        expect(latest?.events).toEqual([]);
        expect(latest?.nextCursor).toBeNull();
        expect(invalidated).toEqual([]);
      });
    }

    it("does not let a late 401 from an equal-valued replaced session clear or invalidate it", async () => {
      const old = deferred<Response>();
      const invalidated: BackendSession[] = [];
      let requestCount = 0;
      globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
        requestCount += 1;
        return requestCount === 1 ? old.promise : response([event("timeline_event_current")], null);
      }) as typeof globalThis.fetch;
      const oldSession = session();
      const replacementSession = { ...oldSession };
      const onInvalidate = (expected: BackendSession) => invalidated.push(expected);

      await mount(oldSession, "card:owned.1", onInvalidate);
      await update(replacementSession, "card:owned.1", onInvalidate);
      expect(latest?.events.map(({ id }) => id)).toEqual(["timeline_event_current"]);
      await settle(old, response([], null, 401));

      expect(latest?.events.map(({ id }) => id)).toEqual(["timeline_event_current"]);
      expect(invalidated).toEqual([]);
    });

    it("does not invalidate a session after unmount when a 401 completes late", async () => {
      const pending = deferred<Response>();
      const invalidated: BackendSession[] = [];
      globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) =>
        pending.promise) as typeof globalThis.fetch;
      await mount(session(), "card:owned.1", (expected) => invalidated.push(expected));
      await act(async () => {
        renderer?.unmount();
        renderer = null;
        await flush();
      });
      await settle(pending, response([], null, 401));
      expect(invalidated).toEqual([]);
    });
  },
);
