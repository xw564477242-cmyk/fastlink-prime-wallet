import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession, type FastLinkEnvironment } from "@/lib/backend-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

type SessionState = {
  checking: boolean;
  session: BackendSession | null;
  error: string | null;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let ConvertPage: () => ReactElement;

const configuredEnvironment =
  backendRuntime.error === null &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Mounted FX quote test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(value: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return value === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-mounted-fx-01",
    tenantId: "tenant-mounted-fx-01",
    customerId: "customer-mounted-fx-01",
    environment: environment(),
    expiresAt: "2099-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function wireQuote(overrides: Record<string, unknown> = {}) {
  return {
    quoteId: "quote-mounted-fx-001",
    environment: environment(),
    sourceAssetCode: "USD",
    targetAssetCode: "MYR",
    sourceAmount: "100",
    targetAmount: "441",
    rate: "4.41",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function json(value: unknown, status = 200, trace = "safe-fx-trace"): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": trace },
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

function renderedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join("");
  if (value && typeof value === "object" && "children" in value) {
    return renderedText((value as ReactTestInstance).children);
  }
  return "";
}

function pageText(): string {
  return renderer ? renderedText(renderer.root) : "";
}

function body(): string {
  return JSON.stringify(renderer?.toJSON() ?? null);
}

function submitForm(): ReactTestInstance {
  if (!renderer) throw new Error("FX quote page is not mounted");
  return renderer.root.findByType("form");
}

function button(): ReactTestInstance {
  if (!renderer) throw new Error("FX quote page is not mounted");
  return renderer.root.findByType("button");
}

function field(label: string): ReactTestInstance {
  if (!renderer) throw new Error("FX quote page is not mounted");
  return renderer.root.findByProps({ "aria-label": label });
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession | null = session()) {
  sessionState = { checking: false, session: currentSession, error: null };
  await act(async () => {
    renderer = create(createElement(ConvertPage));
    await flush();
  });
}

async function rerender(currentSession: BackendSession | null) {
  sessionState = { ...sessionState, session: currentSession };
  await act(async () => {
    renderer?.update(createElement(ConvertPage));
    await flush();
  });
}

async function submit() {
  await act(async () => {
    submitForm().props.onSubmit({ preventDefault() {} });
    await flush();
  });
}

async function rapidDoubleSubmit() {
  await act(async () => {
    submitForm().props.onSubmit({ preventDefault() {} });
    submitForm().props.onSubmit({ preventDefault() {} });
    await flush();
  });
}

async function change(label: string, value: string) {
  await act(async () => {
    field(label).props.onChange({ target: { value } });
    await flush();
  });
}

async function settle(pending: Deferred<Response>, response: Response) {
  await act(async () => {
    pending.resolve(response);
    await pending.promise;
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
}

beforeAll(async () => {
  mock.module("@/lib/backend-session", () => ({ useBackendSession: () => sessionState }));
  mock.module("@tanstack/react-router", () => ({
    createFileRoute: () => (configuration: object) => configuration,
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useNavigate: () => () => undefined,
    useRouterState: () => "/convert",
  }));
  ({ ConvertPage } = await import("./convert"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "document");
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted synthetic FX quote preview (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("does not auto-fetch and rapid double submit produces exactly one scoped POST", async () => {
      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { cookie: "other=value; fastlink_csrf=csrf-mounted-fx" },
      });
      await mount();
      expect(calls).toHaveLength(0);

      await rapidDoubleSubmit();
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.input)).toBe("/api/v1/wallet/fx/quotes");
      expect(calls[0]?.init?.method).toBe("POST");
      expect(calls[0]?.init?.credentials).toBe("include");
      expect(calls[0]?.init?.cache).toBe("no-store");
      expect(new Headers(calls[0]?.init?.headers).get("X-CSRF-Token")).toBe("csrf-mounted-fx");
      expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
        sourceAssetCode: "USD",
        targetAssetCode: "MYR",
        sourceAmount: "100",
      });
      expect(Object.keys(JSON.parse(String(calls[0]?.init?.body))).sort()).toEqual([
        "sourceAmount",
        "sourceAssetCode",
        "targetAssetCode",
      ]);
      expect(button().props.disabled).toBe(true);

      await settle(pending, json(wireQuote()));
      expect(pageText()).toContain("quote-mounted-fx-001");
      expect(pageText()).toContain("441");
      expect(button().props.disabled).toBe(false);
      expect(body()).not.toMatch(/provider|tenant-mounted|customer-mounted/i);
      expect(pageText()).toContain("no conversion confirmation or funds-movement action");
    });

    it("retains the same-scope verified quote on retryable failure without leaking Backend detail", async () => {
      const secret = "provider-upstream-secret-must-not-render";
      let reads = 0;
      installFetch(() => {
        reads += 1;
        return reads === 1 ? json(wireQuote()) : json({ message: secret }, 503, secret);
      });
      await mount();
      await submit();
      expect(pageText()).toContain("quote-mounted-fx-001");
      await submit();
      expect(reads).toBe(2);
      expect(pageText()).toContain("quote-mounted-fx-001");
      expect(pageText()).toContain("temporarily unavailable");
      expect(body()).not.toContain(secret);
    });

    it("clears a previous quote when a later response violates the public contract", async () => {
      let reads = 0;
      installFetch(() => {
        reads += 1;
        return reads === 1
          ? json(wireQuote())
          : json(wireQuote({ targetAmount: "440", provider: "must-not-render" }));
      });
      await mount();
      await submit();
      expect(pageText()).toContain("quote-mounted-fx-001");

      await submit();
      expect(reads).toBe(2);
      expect(pageText()).not.toContain("quote-mounted-fx-001");
      expect(pageText()).toContain("temporarily unavailable");
      expect(body()).not.toContain("must-not-render");
    });

    it("input change aborts and hides the old quote before every late completion", async () => {
      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      await mount();
      await submit();
      expect(calls).toHaveLength(1);
      await change("Target asset", "SGD");
      expect(calls[0]?.init?.signal?.aborted).toBe(true);
      expect(pageText()).not.toContain("quote-mounted-fx-001");
      await settle(pending, json(wireQuote()));
      expect(pageText()).not.toContain("quote-mounted-fx-001");
      expect(pageText()).not.toContain("temporarily unavailable");
    });

    it("actor, tenant, customer, environment and unmount abort old scope with zero late writes", async () => {
      const changes: Array<Partial<BackendSession> | null> = [
        { actorId: "actor-mounted-fx-02" },
        { tenantId: "tenant-mounted-fx-02" },
        { customerId: "customer-mounted-fx-02" },
        { environment: alternateEnvironment(environment()) },
        null,
      ];
      for (const patch of changes) {
        const pending = deferred<Response>();
        const calls = installFetch(() => pending.promise);
        const current = session();
        await mount(current);
        await submit();
        await rerender(patch === null ? null : { ...current, ...patch });
        expect(calls[0]?.init?.signal?.aborted).toBe(true);
        await settle(pending, json(wireQuote()));
        expect(pageText()).not.toContain("quote-mounted-fx-001");
        expect(body()).not.toMatch(/provider|private/i);
        await unmount();
      }

      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      await mount();
      await submit();
      await unmount();
      expect(calls[0]?.init?.signal?.aborted).toBe(true);
      pending.resolve(json(wireQuote()));
      await pending.promise;
      await flush();
    });

    it("marks session invalid only for HTTP 401", async () => {
      let status = 401;
      installFetch(() => json({ message: "private-auth-detail" }, status, "private-trace"));
      await mount();
      await submit();
      expect(pageText()).toContain("authenticated wallet session is no longer valid");
      expect(body()).not.toMatch(/private-auth-detail|private-trace/);

      status = 403;
      await submit();
      expect(pageText()).toContain("temporarily unavailable");
      expect(pageText()).not.toContain("authenticated wallet session is no longer valid");
    });

    it("environment mismatch and invalid input execute zero POSTs", async () => {
      const calls = installFetch(() => json(wireQuote()));
      await mount(session({ environment: alternateEnvironment(environment()) }));
      expect(button().props.disabled).toBe(true);
      await submit();
      expect(calls).toHaveLength(0);
      await unmount();

      await mount();
      await change("Target asset", "USD");
      expect(button().props.disabled).toBe(true);
      await submit();
      expect(calls).toHaveLength(0);
    });
  },
);
