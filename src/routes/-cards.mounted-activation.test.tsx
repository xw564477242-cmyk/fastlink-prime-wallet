import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

type SessionState = {
  checking: boolean;
  session: BackendSession | null;
  error: string | null;
};

const originalFetch = globalThis.fetch;
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let CardsPage: () => ReactElement;
const invalidations: Array<{ session: BackendSession; reason: string }> = [];

const configuredEnvironment =
  backendRuntime.error === null &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (!configuredEnvironment) throw new Error("Card activation mounted test requires /api");
  return configuredEnvironment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-activation-mounted",
    tenantId: "tenant-activation-mounted",
    customerId: "customer-activation-mounted",
    environment: environment(),
    expiresAt: "2099-08-03T00:00:00.000Z",
    ...overrides,
  };
}

function pendingCard(id = "card_pending_1", alias = "Pending Owned Card") {
  return {
    id,
    type: "PHYSICAL",
    status: "PENDING",
    last4: "4242",
    expiryMonth: 12,
    expiryYear: 2030,
    currency: "USD",
    alias,
    availableBalanceMinor: "2500",
    createdAt: "2026-08-01T00:00:00Z",
    capabilities: {
      freeze: false,
      unfreeze: false,
      replace: false,
      renew: false,
      updateLimits: true,
    },
  };
}

function activeCard(id = "card_pending_1", alias = "Pending Owned Card") {
  return {
    ...pendingCard(id, alias),
    status: "ACTIVE",
    capabilities: {
      freeze: true,
      unfreeze: false,
      replace: true,
      renew: true,
      updateLimits: true,
    },
  };
}

function json(value: unknown, status = 200, traceId = "safe-activation-trace"): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": traceId },
  });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function path(input: string | URL | Request): string {
  return new URL(String(input), "https://wallet.fastlink.invalid").pathname;
}

function isList(input: string | URL | Request, init?: RequestInit): boolean {
  return path(input) === "/api/v1/cards" && (init?.method ?? "GET") === "GET";
}

function activationCardId(input: string | URL | Request, init?: RequestInit): string | null {
  if (init?.method !== "POST") return null;
  const match = path(input).match(/^\/api\/v1\/cards\/([^/]+)\/activate$/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

function detailCardId(input: string | URL | Request, init?: RequestInit): string | null {
  if ((init?.method ?? "GET") !== "GET") return null;
  const match = path(input).match(/^\/api\/v1\/cards\/([^/]+)$/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

function publicRead(input: string | URL | Request): Response | null {
  const requestPath = path(input);
  const scoped = requestPath.match(/^\/api\/v1\/cards\/([^/]+)\/(balance|limits|timeline)$/);
  if (!scoped) return null;
  const cardId = decodeURIComponent(scoped[1] ?? "");
  if (scoped[2] === "balance") {
    return json({
      cardId,
      currency: "USD",
      availableBalanceMinor: "2500",
      currentBalanceMinor: "2500",
      pendingAmountMinor: "0",
      updatedAt: "2026-08-03T00:00:00Z",
    });
  }
  if (scoped[2] === "limits") {
    return json({
      cardId,
      singleTransactionMinor: null,
      dailySpendMinor: null,
      monthlySpendMinor: null,
      dailyAtmMinor: null,
      updatedAt: null,
    });
  }
  return json({ events: [], nextCursor: null });
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

function installCsrfCookie(value: string) {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie: `fastlink_csrf=${encodeURIComponent(value)}` },
  });
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

function button(label: string): ReactTestInstance {
  if (!renderer) throw new Error("Cards page is not mounted");
  const found = renderer.root
    .findAllByType("button")
    .find((candidate) => renderedText(candidate).includes(label));
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

function uuidHeader(call: { init?: RequestInit } | undefined): string | null {
  return new Headers(call?.init?.headers).get("Idempotency-Key");
}

function isUuidV4(value: string | null): boolean {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value),
  );
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession | null = session()) {
  sessionState = { checking: false, session: currentSession, error: null };
  await act(async () => {
    renderer = create(createElement(CardsPage));
    await flush();
  });
}

async function rerender(currentSession: BackendSession | null) {
  if (!renderer) throw new Error("Cards page is not mounted");
  sessionState = { ...sessionState, session: currentSession };
  await act(async () => {
    renderer?.update(createElement(CardsPage));
    await flush();
  });
}

async function resolvePending(pending: Deferred<Response>, response: Response) {
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
  mock.module("@/lib/backend-session", () => ({
    useBackendSession: () => ({
      ...sessionState,
      invalidate: (expectedSession: BackendSession, reason: string) => {
        invalidations.push({ session: expectedSession, reason });
      },
    }),
  }));
  mock.module("@/lib/i18n", () => ({
    useLang: () => ({
      lang: "en",
      t: (key: string) => {
        if (key === "cards.freeze") return "Freeze";
        if (key === "cards.unfreeze") return "Unfreeze";
        if (key === "cards.defaultVirtualAlias") return "Virtual Card";
        return key;
      },
    }),
  }));
  mock.module("@tanstack/react-router", () => ({
    createFileRoute: () => (configuration: object) => ({
      ...configuration,
      useSearch: () => ({}),
    }),
    useNavigate: () => () => undefined,
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useRouterState: () => "/cards",
  }));
  ({ CardsPage } = await import("./cards"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  invalidations.length = 0;
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "document");
  }
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted selected Card activation (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("uses one bodyless same-origin Cookie/CSRF POST, then waits for an ACTIVE detail refresh", async () => {
      installCsrfCookie("csrf-activation-contract");
      const post = deferred<Response>();
      const detail = deferred<Response>();
      let mutationReads = 0;
      let detailReads = 0;
      const calls = installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) {
          mutationReads += 1;
          return post.promise;
        }
        if (detailCardId(input, init)) {
          detailReads += 1;
          return detail.promise;
        }
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      expect(pageText()).toContain("Activate card");
      await act(async () => {
        void button("Activate card").props.onClick();
        void button("Activate card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(detailReads).toBe(0);
      await resolvePending(
        post,
        json({ status: "ACTIVE", provider: "provider-secret", cvv: "999", pin: "1234" }, 201),
      );
      expect(detailReads).toBe(1);
      expect(pageText()).toContain("PENDING");
      expect(body()).not.toMatch(/provider-secret|999|1234/);
      await resolvePending(detail, json(activeCard()));
      expect(pageText()).toContain("ACTIVE");
      expect(pageText()).not.toContain("Activate card");

      const mutations = calls.filter(({ input, init }) => activationCardId(input, init));
      expect(mutations).toHaveLength(1);
      expect(path(mutations[0]!.input)).toBe("/api/v1/cards/card_pending_1/activate");
      expect(mutations[0]!.init?.body).toBeUndefined();
      expect(mutations[0]!.init?.credentials).toBe("include");
      expect(new Headers(mutations[0]!.init?.headers).get("X-CSRF-Token")).toBe(
        "csrf-activation-contract",
      );
      expect(isUuidV4(uuidHeader(mutations[0]))).toBeTrue();
      expect(calls.some(({ input }) => /\/api\/cards|\/pin|\/cvv/.test(path(input)))).toBeFalse();
    });

    it("blocks the current Card generation when a successful POST is not confirmed ACTIVE", async () => {
      const cases: Array<{ name: string; response: () => Response }> = [
        { name: "PENDING", response: () => json(pendingCard()) },
        {
          name: "extra field",
          response: () => json({ ...activeCard(), providerOperationRef: "provider-secret" }),
        },
        { name: "403", response: () => json({ message: "forbidden-secret" }, 403) },
        { name: "404", response: () => json({ message: "missing-secret" }, 404) },
      ];

      for (const probe of cases) {
        let mutationReads = 0;
        const calls = installFetch((input, init) => {
          if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
          if (activationCardId(input, init)) {
            mutationReads += 1;
            return json({ status: "ACTIVE" }, 201);
          }
          if (detailCardId(input, init)) return probe.response();
          const read = publicRead(input);
          if (read) return read;
          throw new Error(`Unexpected request ${String(input)}`);
        });

        await mount();
        await act(async () => {
          void button("Activate card").props.onClick();
          await flush();
        });

        expect(mutationReads, probe.name).toBe(1);
        expect(pageText(), probe.name).toContain("PENDING");
        expect(pageText(), probe.name).toContain(
          "Refresh this Card before another activation attempt.",
        );
        expect(button("Refresh Card first").props.disabled, probe.name).toBeTrue();
        await act(async () => {
          void button("Refresh Card first").props.onClick();
          await flush();
        });
        expect(mutationReads, probe.name).toBe(1);
        expect(calls.filter(({ input, init }) => activationCardId(input, init))).toHaveLength(1);
        expect(invalidations, probe.name).toHaveLength(0);
        expect(body(), probe.name).not.toMatch(/provider-secret|forbidden-secret|missing-secret/);
        await unmount();
      }
    });

    it("removes activation after a real refresh confirms ACTIVE", async () => {
      let mutationReads = 0;
      let detailReads = 0;
      installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) {
          mutationReads += 1;
          return json({ status: "ACTIVE" }, 201);
        }
        if (detailCardId(input, init)) {
          detailReads += 1;
          return detailReads === 1 ? json(pendingCard()) : json(activeCard());
        }
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });

      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      expect(pageText()).toContain("Refresh this Card before another activation attempt.");
      await act(async () => {
        void button("cards.refresh").props.onClick();
        await flush();
      });

      expect(mutationReads).toBe(1);
      expect(detailReads).toBe(2);
      expect(pageText()).toContain("ACTIVE");
      expect(pageText()).not.toContain("Activate card");
      expect(invalidations).toHaveLength(0);
    });

    it("allows a new key only after a real refresh returns a new PENDING generation", async () => {
      let mutationReads = 0;
      let detailReads = 0;
      const calls = installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) {
          mutationReads += 1;
          return json({ status: "ACTIVE" }, 201);
        }
        if (detailCardId(input, init)) {
          detailReads += 1;
          return detailReads < 3 ? json(pendingCard()) : json(activeCard());
        }
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });

      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(button("Refresh Card first").props.disabled).toBeTrue();

      await act(async () => {
        void button("cards.refresh").props.onClick();
        await flush();
      });
      expect(pageText()).toContain("PENDING");
      expect(pageText()).toContain("Activate card");

      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      const mutations = calls.filter(({ input, init }) => activationCardId(input, init));
      expect(mutationReads).toBe(2);
      expect(mutations).toHaveLength(2);
      expect(isUuidV4(uuidHeader(mutations[0]))).toBeTrue();
      expect(isUuidV4(uuidHeader(mutations[1]))).toBeTrue();
      expect(uuidHeader(mutations[1])).not.toBe(uuidHeader(mutations[0]));
      expect(pageText()).toContain("ACTIVE");
      expect(pageText()).not.toContain("Activate card");
      expect(invalidations).toHaveLength(0);
    });

    it("keeps the verified PENDING Card and Session for 408, 409 and 5xx", async () => {
      for (const status of [408, 409, 500, 503, 599]) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
          if (activationCardId(input, init)) {
            mutationReads += 1;
            return json({ message: "provider-secret", pin: "1234" }, status, "trace-secret");
          }
          const read = publicRead(input);
          if (read) return read;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Activate card").props.onClick();
          await flush();
        });
        expect(mutationReads, String(status)).toBe(1);
        expect(pageText(), String(status)).toContain("PENDING");
        expect(pageText(), String(status)).toContain("Retry once to reuse the same request key.");
        expect(invalidations, String(status)).toHaveLength(0);
        expect(body(), String(status)).not.toMatch(/provider-secret|trace-secret|1234/);
        await unmount();
      }
    });

    it("performs exactly one explicit same-key recovery and confirms through GET", async () => {
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) {
          mutationReads += 1;
          return mutationReads === 1
            ? json({ message: "uncertain" }, 504)
            : json({ status: "ACTIVE" }, 201);
        }
        if (detailCardId(input, init)) return json(activeCard());
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      await act(async () => {
        void button("Retry activation").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      expect(pageText()).toContain("ACTIVE");
      const mutations = calls.filter(({ input, init }) => activationCardId(input, init));
      expect(mutations.map(uuidHeader)).toEqual([
        uuidHeader(mutations[0]),
        uuidHeader(mutations[0]),
      ]);
      expect(invalidations).toHaveLength(0);
    });

    it("blocks a fresh key when the one same-key recovery is still ambiguous", async () => {
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) {
          mutationReads += 1;
          return json({ message: "still-uncertain" }, 409);
        }
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      await act(async () => {
        void button("Retry activation").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      expect(pageText()).toContain("Refresh this Card before another activation attempt.");
      expect(button("Refresh Card first").props.disabled).toBeTrue();
      const mutations = calls.filter(({ input, init }) => activationCardId(input, init));
      expect(mutations.map(uuidHeader)).toEqual([
        uuidHeader(mutations[0]),
        uuidHeader(mutations[0]),
      ]);
      expect(invalidations).toHaveLength(0);
    });

    it("invalidates only the exact current Session for an explicit 401", async () => {
      const current = session();
      installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) return json({ message: "unauthorized-secret" }, 401);
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount(current);
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      expect(invalidations).toEqual([{ session: current, reason: "EXPLICIT_401" }]);
      expect(pageText()).toContain("PENDING");
      expect(body()).not.toContain("unauthorized-secret");

      await unmount();
      invalidations.length = 0;
      const late = deferred<Response>();
      installFetch((input, init) => {
        if (isList(input, init)) return json({ cards: [pendingCard()], nextCursor: null });
        if (activationCardId(input, init)) return late.promise;
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount(current);
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      await rerender(session({ actorId: "actor-new-session" }));
      await resolvePending(late, json({ message: "late-unauthorized" }, 401));
      expect(invalidations).toHaveLength(0);
      expect(pageText()).toContain("PENDING");
    });

    it("gives late POST and detail responses zero writes after Card selection changes", async () => {
      const post = deferred<Response>();
      const detail = deferred<Response>();
      let detailReads = 0;
      installFetch((input, init) => {
        if (isList(input, init)) {
          return json({
            cards: [pendingCard(), pendingCard("card_pending_2", "Second Pending Card")],
            nextCursor: null,
          });
        }
        if (activationCardId(input, init)) return post.promise;
        if (detailCardId(input, init)) {
          detailReads += 1;
          return detail.promise;
        }
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      await act(async () => {
        button("Second Pending Card").props.onClick();
        await flush();
      });
      await resolvePending(post, json({ status: "ACTIVE" }, 201));
      expect(detailReads).toBe(0);
      expect(pageText()).toContain("Second Pending Card");
      expect(pageText()).toContain("PENDING");

      await unmount();
      installFetch((input, init) => {
        if (isList(input, init)) {
          return json({
            cards: [pendingCard(), pendingCard("card_pending_2", "Second Pending Card")],
            nextCursor: null,
          });
        }
        if (activationCardId(input, init)) return json({ status: "ACTIVE" }, 201);
        if (detailCardId(input, init)) return detail.promise;
        const read = publicRead(input);
        if (read) return read;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Activate card").props.onClick();
        await flush();
      });
      await act(async () => {
        button("Second Pending Card").props.onClick();
        await flush();
      });
      await resolvePending(detail, json(activeCard()));
      expect(pageText()).toContain("Second Pending Card");
      expect(pageText()).toContain("PENDING");
      expect(invalidations).toHaveLength(0);
    });
  },
);
