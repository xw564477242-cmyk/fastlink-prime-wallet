import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { BackendSession, FastLinkEnvironment } from "@/lib/backend-api";
import type { KycStatusRuntime, KycStatusSnapshot } from "@/lib/kyc-status-state";
import { useKycStatus } from "./use-kyc-status";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useKycStatus>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};
type HarnessProps = {
  currentSession: BackendSession | null;
  runtime: KycStatusRuntime;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;

function runtime(environment: FastLinkEnvironment | undefined = "SANDBOX"): KycStatusRuntime {
  return { apiUrl: "/api", environment, error: null };
}

function session(
  environment: FastLinkEnvironment = "SANDBOX",
  patch: Partial<BackendSession> = {},
): BackendSession {
  return {
    actorId: "actor-kyc-hook",
    tenantId: "tenant-kyc-hook",
    customerId: "customer-kyc-hook",
    environment,
    expiresAt: "2099-08-02T00:00:00.000Z",
    ...patch,
  };
}

function response(snapshot: KycStatusSnapshot, status = 200): Response {
  return new Response(JSON.stringify(snapshot), {
    status,
    headers: { "content-type": "application/json" },
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
  }) as typeof fetch;
  return calls;
}

function Harness(props: HarnessProps) {
  latest = useKycStatus(props.currentSession, props.runtime);
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(props: Partial<HarnessProps> = {}): Promise<HarnessProps> {
  const complete = {
    currentSession: session(),
    runtime: runtime(),
    ...props,
  };
  await act(async () => {
    renderer = create(createElement(Harness, complete));
    await flush();
  });
  return complete;
}

async function update(props: HarnessProps) {
  await act(async () => {
    renderer?.update(createElement(Harness, props));
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
});

describe("Mounted KYC status manual refresh", () => {
  it("performs zero automatic reads and atomically installs one strict response per click", async () => {
    const calls = installFetch(() => response({ status: "PENDING", reviewedAt: null }));
    await mount();
    expect(calls).toHaveLength(0);
    expect(latest?.canRefresh).toBe(true);
    expect(latest?.snapshot).toBeNull();

    await act(async () => {
      latest?.refresh();
      await flush();
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.input)).toBe("/api/v1/kyc/status");
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    expect(latest?.snapshot).toEqual({ status: "PENDING", reviewedAt: null });
    expect(latest?.loading).toBe(false);
    expect(latest?.error).toBeNull();
  });

  it("aborts repeated reads and ignores their late success or failure", async () => {
    const initial = { status: "PENDING", reviewedAt: null } as const;
    const stale = deferred<Response>();
    const current = deferred<Response>();
    let call = 0;
    const calls = installFetch(() => {
      call += 1;
      if (call === 1) return response(initial);
      if (call === 2) return stale.promise;
      return current.promise;
    });
    await mount();
    await act(async () => {
      latest?.refresh();
      await flush();
    });
    expect(latest?.snapshot).toEqual(initial);

    await act(async () => {
      latest?.refresh();
      await flush();
    });
    await act(async () => {
      latest?.refresh();
      await flush();
    });
    expect(calls[1]?.init?.signal?.aborted).toBe(true);
    expect(latest?.snapshot).toEqual(initial);

    const approved = { status: "APPROVED", reviewedAt: "2026-08-02T01:00:00.000Z" } as const;
    await act(async () => {
      current.resolve(response(approved));
      await current.promise;
      await flush();
    });
    expect(latest?.snapshot).toEqual(approved);

    await act(async () => {
      stale.reject(new Error("late-provider-secret"));
      await stale.promise.catch(() => undefined);
      await flush();
    });
    expect(latest?.snapshot).toEqual(approved);
    expect(latest?.error).toBeNull();
  });

  it("retains only the same-scope verified snapshot across 408, 5xx and parse failures", async () => {
    const verified = { status: "PENDING", reviewedAt: null } as const;
    const failures = [
      new Response('{"message":"timeout-secret"}', { status: 408 }),
      new Response('{"message":"server-secret"}', { status: 503 }),
      new Response('{"status":"APPROVED","reviewedAt":null,"secret":true}', { status: 200 }),
    ];
    let call = 0;
    installFetch(() => (call++ === 0 ? response(verified) : failures.shift()!));
    await mount();
    await act(async () => {
      latest?.refresh();
      await flush();
    });

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(latest?.snapshot).toEqual(verified);
      expect(latest?.error).toBe("KYC status is temporarily unavailable");
      expect(JSON.stringify(latest)).not.toMatch(/timeout-secret|server-secret|provider/i);
    }
  });

  it("aborts and rejects late writes after session, scope, environment and mount changes", async () => {
    const pendingReads: Deferred<Response>[] = [];
    const calls = installFetch(() => {
      const pending = deferred<Response>();
      pendingReads.push(pending);
      return pending.promise;
    });
    let props = await mount();

    const changeAndExpectAbort = async (next: HarnessProps) => {
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      const request = calls.at(-1);
      expect(request?.init?.signal?.aborted).toBe(false);
      await update(next);
      expect(request?.init?.signal?.aborted).toBe(true);
      expect(latest?.snapshot).toBeNull();
      expect(latest?.error).toBeNull();
      props = next;
    };

    await changeAndExpectAbort({
      ...props,
      currentSession: session("SANDBOX", { tenantId: "tenant-other" }),
    });
    await changeAndExpectAbort({
      ...props,
      currentSession: session("SANDBOX", {
        tenantId: "tenant-other",
        customerId: "customer-other",
      }),
    });
    await changeAndExpectAbort({
      ...props,
      currentSession: session("SANDBOX", {
        actorId: "actor-other",
        tenantId: "tenant-other",
        customerId: "customer-other",
      }),
    });
    await changeAndExpectAbort({
      ...props,
      currentSession: session("SANDBOX", {
        actorId: "actor-other",
        tenantId: "tenant-other",
        customerId: "customer-other",
        expiresAt: "2099-08-03T00:00:00.000Z",
      }),
    });
    await changeAndExpectAbort({ currentSession: session("TEST"), runtime: runtime("TEST") });
    await changeAndExpectAbort({ currentSession: null, runtime: runtime("TEST") });

    await update({ currentSession: session("TEST"), runtime: runtime("TEST") });
    await act(async () => {
      latest?.refresh();
      await flush();
    });
    const unmountedRequest = calls.at(-1);
    await unmount();
    expect(unmountedRequest?.init?.signal?.aborted).toBe(true);

    for (const [index, pending] of pendingReads.entries()) {
      pending.resolve(
        response({ status: "APPROVED", reviewedAt: `2026-08-02T01:00:0${index}.000Z` }),
      );
    }
    await flush();

    installFetch(() => response({ status: "REJECTED", reviewedAt: null }));
    await mount({ currentSession: session("TEST"), runtime: runtime("TEST") });
    expect(latest?.snapshot).toBeNull();
    await act(async () => {
      latest?.refresh();
      await flush();
    });
    expect(latest?.snapshot).toEqual({ status: "REJECTED", reviewedAt: null });
  });

  it("fails unsafe environments and missing, empty, invalid or past expiry closed without a fetch", async () => {
    const calls = installFetch(() => response({ status: "APPROVED", reviewedAt: null }));
    const blocked: HarnessProps[] = [
      { currentSession: session("LOCAL"), runtime: runtime("LOCAL") },
      { currentSession: session("UAT"), runtime: runtime("UAT") },
      { currentSession: session("PRODUCTION"), runtime: runtime("PRODUCTION") },
      {
        currentSession: session("SANDBOX"),
        runtime: runtime("UNKNOWN" as FastLinkEnvironment),
      },
      { currentSession: session("TEST"), runtime: runtime("SANDBOX") },
      {
        currentSession: session("SANDBOX", { expiresAt: undefined }),
        runtime: runtime("SANDBOX"),
      },
      {
        currentSession: session("SANDBOX", { expiresAt: "" }),
        runtime: runtime("SANDBOX"),
      },
      {
        currentSession: session("SANDBOX", { expiresAt: "invalid-expiry" }),
        runtime: runtime("SANDBOX"),
      },
      {
        currentSession: session("SANDBOX", { expiresAt: "2000-01-01T00:00:00.000Z" }),
        runtime: runtime("SANDBOX"),
      },
    ];

    for (const props of blocked) {
      await mount(props);
      expect(latest?.canRefresh).toBe(false);
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls).toHaveLength(0);
      expect(latest?.snapshot).toBeNull();
      await unmount();
    }
  });
});
