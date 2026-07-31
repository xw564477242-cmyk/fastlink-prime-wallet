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
const traceSecret = "trace-create-secret-must-not-render";
const providerSecret = "provider-create-secret-must-not-render";
const walletSecret = "wallet-create-secret-must-not-render";
const journalSecret = "journal-create-secret-must-not-render";
const internalSecret = "internal-create-secret-must-not-render";
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let createAlias = "Mounted Virtual";
let CardsPage: () => ReactElement;
const navigations: Array<Record<string, unknown>> = [];

const configuredEnvironment =
  backendRuntime.error === null &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function testEnvironment(): "SANDBOX" | "TEST" {
  if (
    backendRuntime.error ||
    backendRuntime.apiUrl !== "/api" ||
    (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST")
  ) {
    throw new Error("Mounted Virtual Card test requires SANDBOX or TEST with /api");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-mounted-create-01",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-mounted-create-01",
    customerId: "customer-mounted-create-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function card(id: string, last4: string, alias: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "VIRTUAL",
    status: "ACTIVE",
    last4,
    expiryMonth: 12,
    expiryYear: 2030,
    currency: "USD",
    alias,
    availableBalanceMinor: "0",
    createdAt: "2026-08-01T00:00:00.000Z",
    capabilities: {
      freeze: true,
      unfreeze: false,
      replace: false,
      renew: false,
      updateLimits: true,
    },
    ...overrides,
  };
}

function statusCard(id: string, action: "freeze" | "unfreeze", overrides = {}) {
  return {
    ...card(id, "4242", "Owned Status Card"),
    status: action === "freeze" ? "FROZEN" : "ACTIVE",
    capabilities: {
      freeze: action === "unfreeze",
      unfreeze: action === "freeze",
      replace: false,
      renew: false,
      updateLimits: true,
    },
    ...overrides,
  };
}

function renewableCard(id: string, last4: string, alias: string, overrides = {}) {
  return {
    ...card(id, last4, alias),
    capabilities: {
      freeze: true,
      unfreeze: false,
      replace: false,
      renew: true,
      updateLimits: true,
    },
    ...overrides,
  };
}

function replaceableCard(id: string, last4: string, alias: string, overrides = {}) {
  return {
    ...card(id, last4, alias),
    capabilities: {
      freeze: true,
      unfreeze: false,
      replace: true,
      renew: false,
      updateLimits: true,
    },
    ...overrides,
  };
}

function balance(cardId: string) {
  return {
    cardId,
    currency: "USD",
    availableBalanceMinor: "0",
    currentBalanceMinor: "0",
    pendingAmountMinor: "0",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function limits(cardId: string) {
  return {
    cardId,
    singleTransactionMinor: null,
    dailySpendMinor: null,
    monthlySpendMinor: null,
    dailyAtmMinor: null,
    updatedAt: null,
  };
}

function mutableLimits(cardId: string, overrides: Record<string, unknown> = {}) {
  return {
    cardId,
    singleTransactionMinor: "10000",
    dailySpendMinor: "50000",
    monthlySpendMinor: "500000",
    dailyAtmMinor: "20000",
    updatedAt: "2026-07-31T10:00:00Z",
    ...overrides,
  };
}

function json(value: unknown, status = 200, traceId = "safe-create-trace"): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": traceId },
  });
}

function cardPage(cards: unknown[]): Response {
  return json({ cards, nextCursor: null });
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

function requestPath(input: string | URL | Request): string {
  return new URL(String(input), "https://wallet.invalid").pathname;
}

function isCardList(input: string | URL | Request): boolean {
  return requestPath(input) === "/api/v1/cards";
}

function isCreate(input: string | URL | Request, init?: RequestInit): boolean {
  return requestPath(input) === "/api/v1/cards/virtual" && init?.method === "POST";
}

function isLimitsMutation(input: string | URL | Request, init?: RequestInit): boolean {
  return selectedCardId(input, "limits") !== null && init?.method === "POST";
}

function statusMutationAction(
  input: string | URL | Request,
  init?: RequestInit,
): "freeze" | "unfreeze" | null {
  if (init?.method !== "POST") return null;
  const match = requestPath(input).match(/\/api\/v1\/cards\/[^/]+\/(freeze|unfreeze)$/);
  return (match?.[1] as "freeze" | "unfreeze" | undefined) ?? null;
}

function isRenewMutation(input: string | URL | Request, init?: RequestInit): boolean {
  return init?.method === "POST" && /\/api\/v1\/cards\/[^/]+\/renew$/.test(requestPath(input));
}

function isReplaceMutation(input: string | URL | Request, init?: RequestInit): boolean {
  return init?.method === "POST" && /\/api\/v1\/cards\/[^/]+\/replace$/.test(requestPath(input));
}

function selectedCardId(
  input: string | URL | Request,
  suffix: "balance" | "limits",
): string | null {
  const match = requestPath(input).match(new RegExp(`/api/v1/cards/([^/]+)/${suffix}$`));
  return match ? decodeURIComponent(match[1] ?? "") : null;
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

function publicReadResponse(input: string | URL | Request): Response | null {
  const balanceCardId = selectedCardId(input, "balance");
  if (balanceCardId) return json(balance(balanceCardId));
  const limitsCardId = selectedCardId(input, "limits");
  return limitsCardId ? json(limits(limitsCardId)) : null;
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
  const match = renderer.root
    .findAllByType("button")
    .find((candidate) => renderedText(candidate).includes(label));
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

function limitInput(label: string): ReactTestInstance {
  if (!renderer) throw new Error("Cards page is not mounted");
  const match = renderer.root
    .findAllByType("label")
    .find((candidate) => renderedText(candidate).includes(label));
  if (!match) throw new Error(`Missing limits input: ${label}`);
  return match.findByType("input");
}

function replacementReasonSelect(): ReactTestInstance {
  if (!renderer) throw new Error("Cards page is not mounted");
  return renderer.root.findByType("select");
}

async function setReplacementReason(value: "LOST" | "STOLEN" | "DAMAGED" | "OTHER") {
  await act(async () => {
    replacementReasonSelect().props.onChange({ target: { value } });
    await flush();
  });
}

async function setLimit(label: string, value: string) {
  await act(async () => {
    limitInput(label).props.onChange({ target: { value } });
    await flush();
  });
}

function uuidHeader(call: { init?: RequestInit } | undefined): string | null {
  return new Headers(call?.init?.headers).get("Idempotency-Key");
}

function isUuidV4(value: string | null): boolean {
  return (
    !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
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

async function rerender(currentSession: BackendSession | null = session()) {
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

async function rejectPending(pending: Deferred<Response>, reason: unknown) {
  await act(async () => {
    pending.reject(reason);
    await pending.promise.catch(() => undefined);
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
  mock.module("@/lib/i18n", () => ({
    useLang: () => ({
      lang: "en",
      t: (key: string) => {
        if (key === "cards.issueNew") return "Issue Virtual Card";
        if (key === "cards.defaultVirtualAlias") return createAlias;
        if (key === "cards.freeze") return "Freeze";
        if (key === "cards.unfreeze") return "Unfreeze";
        return key;
      },
    }),
  }));
  mock.module("@tanstack/react-router", () => ({
    createFileRoute: () => (configuration: object) => ({
      ...configuration,
      useSearch: () => ({}),
    }),
    useNavigate: () => (value: Record<string, unknown>) => {
      navigations.push(value);
    },
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useRouterState: () => "/cards",
  }));
  ({ CardsPage } = await import("./cards"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  navigations.length = 0;
  createAlias = "Mounted Virtual";
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted Virtual Card ownership confirmation (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("uses one POST and one fresh UUIDv4 per submit, then selects only after one ownership refresh", async () => {
      const creates = [deferred<Response>(), deferred<Response>()];
      const confirmations = [deferred<Response>(), deferred<Response>()];
      let listReads = 0;
      let postReads = 0;
      const calls = installFetch((input, init) => {
        if (isCardList(input)) {
          listReads += 1;
          return listReads === 1 ? cardPage([]) : confirmations[listReads - 2]!.promise;
        }
        if (isCreate(input, init)) return creates[postReads++]!.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();

      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      expect(postReads).toBe(1);
      await resolvePending(creates[0]!, json(card("card:created.1", "1111", "POST Alias One")));
      expect(listReads).toBe(2);
      expect(pageText()).not.toMatch(/1111|POST Alias One/);
      expect(navigations).toHaveLength(0);
      await resolvePending(
        confirmations[0]!,
        cardPage([card("card:created.1", "1111", "Confirmed Alias One")]),
      );
      expect(pageText()).toContain("Confirmed Alias One");
      expect(pageText()).not.toContain("POST Alias One");
      expect(navigations).toEqual([{ search: { cardId: "card:created.1" }, replace: true }]);

      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      expect(postReads).toBe(2);
      await resolvePending(creates[1]!, json(card("card:created.2", "2222", "POST Alias Two")));
      expect(listReads).toBe(3);
      expect(pageText()).not.toContain("POST Alias Two");
      await resolvePending(
        confirmations[1]!,
        cardPage([
          card("card:created.1", "1111", "Confirmed Alias One"),
          card("card:created.2", "2222", "Confirmed Alias Two"),
        ]),
      );
      expect(pageText()).toContain("Confirmed Alias Two");
      expect(navigations.at(-1)).toEqual({
        search: { cardId: "card:created.2" },
        replace: true,
      });

      const posts = calls.filter(({ input, init }) => isCreate(input, init));
      const keys = posts.map(uuidHeader);
      expect(keys.every(isUuidV4)).toBeTrue();
      expect(new Set(keys).size).toBe(2);
      expect(postReads).toBe(2);
      expect(listReads).toBe(3);
    });

    it("fails closed when ownership refresh omits or duplicates the created Card, or the ID conflicts", async () => {
      for (const mode of ["missing", "duplicate", "malformed", "conflict"] as const) {
        const created = deferred<Response>();
        const confirmation = deferred<Response>();
        const existing = card("card:existing", "4242", "Existing Card");
        let listReads = 0;
        let postReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            listReads += 1;
            if (listReads === 1) return cardPage(mode === "conflict" ? [existing] : []);
            return confirmation.promise;
          }
          if (isCreate(input, init)) {
            postReads += 1;
            return created.promise;
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Issue Virtual Card").props.onClick();
          await flush();
        });
        const createdId = mode === "conflict" ? "card:existing" : "card:unconfirmed";
        await resolvePending(created, json(card(createdId, "9999", "Unconfirmed Card")));

        if (mode !== "conflict") {
          expect(listReads).toBe(2);
          await resolvePending(
            confirmation,
            mode === "missing"
              ? cardPage([])
              : mode === "malformed"
                ? cardPage([{ ...card(createdId, "9999", "Malformed Card"), last4: "99" }])
                : cardPage([
                    card(createdId, "9999", "Duplicate One"),
                    card(createdId, "9999", "Duplicate Two"),
                  ]),
          );
        }
        expect(postReads).toBe(1);
        expect(pageText()).not.toMatch(
          /Unconfirmed Card|Duplicate One|Duplicate Two|Malformed Card|9999/,
        );
        expect(navigations).toHaveLength(0);
        expect(body()).not.toMatch(/provider|trace-create-secret|internal-create-secret/i);
        await unmount();
      }
    });

    it("allows stale success, error and finally zero page writes after every scope or input change", async () => {
      const changes: Array<{
        label: string;
        next?: BackendSession | null;
        alias?: string;
      }> = [
        { label: "actor", next: session({ actorId: "actor-mounted-create-02" }) },
        { label: "tenant", next: session({ tenantId: "tenant-mounted-create-02" }) },
        { label: "customer", next: session({ customerId: "customer-mounted-create-02" }) },
        {
          label: "environment",
          next: session({ environment: alternateEnvironment(testEnvironment()) }),
        },
        { label: "expiresAt", next: session({ expiresAt: "2099-08-01T01:00:00.000Z" }) },
        { label: "logout", next: null },
        { label: "input", alias: "Changed Virtual Input" },
      ];

      for (const change of changes) {
        const created = deferred<Response>();
        let postReads = 0;
        let listReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            listReads += 1;
            return cardPage([]);
          }
          if (isCreate(input, init)) {
            postReads += 1;
            return created.promise;
          }
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Issue Virtual Card").props.onClick();
          await flush();
        });
        if (change.alias) createAlias = change.alias;
        await rerender(change.next === undefined ? session() : change.next);
        await resolvePending(
          created,
          json({
            ...card("card:stale", "7777", "Stale Created Card"),
            providerPayload: providerSecret,
            walletRef: walletSecret,
            journalIds: [journalSecret],
            secret: internalSecret,
          }),
        );
        expect(postReads, change.label).toBe(1);
        expect(listReads, change.label).toBe(change.next === null ? 1 : 2);
        expect(pageText(), change.label).not.toMatch(/Stale Created Card|7777/);
        expect(body(), change.label).not.toMatch(
          /provider-create-secret|wallet-create-secret|journal-create-secret|internal-create-secret|trace-create-secret/,
        );
        expect(navigations, change.label).toHaveLength(0);
        await unmount();
      }

      const created = deferred<Response>();
      const confirmation = deferred<Response>();
      let listReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          listReads += 1;
          return listReads === 1 ? cardPage([]) : confirmation.promise;
        }
        if (isCreate(input, init)) return created.promise;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      await resolvePending(created, json(card("card:stale-refresh", "6767", "Old Input Card")));
      expect(listReads).toBe(2);
      createAlias = "Changed During Ownership Refresh";
      await rerender();
      await resolvePending(
        confirmation,
        cardPage([card("card:stale-refresh", "6767", "Stale Ownership Refresh")]),
      );
      expect(pageText()).not.toMatch(/Old Input Card|Stale Ownership Refresh|6767/);
      expect(navigations).toHaveLength(0);
      await unmount();

      const rejected = deferred<Response>();
      installFetch((input, init) => {
        if (isCardList(input)) return cardPage([]);
        if (isCreate(input, init)) return rejected.promise;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      await rerender(session({ actorId: "actor-mounted-create-error" }));
      await rejectPending(rejected, new Error(internalSecret));
      expect(body()).not.toMatch(/Virtual Card creation failed|internal-create-secret/);
    });

    it("keeps Provider and secret fields out of the page and selects only refreshed public data", async () => {
      const confirmation = deferred<Response>();
      let listReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          listReads += 1;
          return listReads === 1 ? cardPage([]) : confirmation.promise;
        }
        if (isCreate(input, init)) {
          return json({
            ...card("card:public", "3131", "POST Public Alias"),
            providerPayload: providerSecret,
            providerCardId: providerSecret,
            walletRef: walletSecret,
            journalIds: [journalSecret],
            secret: internalSecret,
            traceId: traceSecret,
          });
        }
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      expect(pageText()).not.toContain("POST Public Alias");
      await resolvePending(
        confirmation,
        cardPage([card("card:public", "3131", "Refreshed Public Alias")]),
      );
      expect(pageText()).toContain("Refreshed Public Alias");
      expect(pageText()).not.toContain("POST Public Alias");
      expect(body()).not.toMatch(
        /provider-create-secret|wallet-create-secret|journal-create-secret|internal-create-secret|trace-create-secret/,
      );
    });

    it("does not retry a failed create and never renders Backend error bodies or trace IDs", async () => {
      let listReads = 0;
      let postReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          listReads += 1;
          return cardPage([]);
        }
        if (isCreate(input, init)) {
          postReads += 1;
          return json({ message: internalSecret, provider: providerSecret }, 502, traceSecret);
        }
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Issue Virtual Card").props.onClick();
        void button("Issue Virtual Card").props.onClick();
        await flush();
      });
      expect(postReads).toBe(1);
      expect(listReads).toBe(1);
      expect(pageText()).toContain("Virtual Card creation failed. Try again.");
      expect(body()).not.toMatch(
        /internal-create-secret|provider-create-secret|trace-create-secret/,
      );
      await act(flush);
      expect(postReads).toBe(1);
      expect(listReads).toBe(1);
    });
  },
);

describeConfigured(
  `Mounted selected Card renewal (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("sends at most one bodyless POST per click with a fresh UUIDv4 and only a forward expiry", async () => {
      const pending = [deferred<Response>(), deferred<Response>()];
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([renewableCard("card:renew.1", "4242", "Owned Renew Card")]);
        }
        if (isRenewMutation(input, init)) return pending[mutationReads++]!.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();

      await act(async () => {
        void button("Renew card").props.onClick();
        void button("Renew card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      await resolvePending(
        pending[0]!,
        json({
          ...renewableCard("card:renew.1", "4242", "Owned Renew Card", {
            expiryMonth: 1,
            expiryYear: 2031,
          }),
          providerOperationId: providerSecret,
          traceId: traceSecret,
          internalId: internalSecret,
        }),
      );
      expect(pageText()).toContain("01/31");
      expect(body()).not.toMatch(
        /provider-create-secret|trace-create-secret|internal-create-secret/,
      );

      await act(async () => {
        void button("Renew card").props.onClick();
        void button("Renew card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      await resolvePending(
        pending[1]!,
        json(
          renewableCard("card:renew.1", "4242", "Owned Renew Card", {
            expiryMonth: 2,
            expiryYear: 2032,
          }),
        ),
      );
      expect(pageText()).toContain("02/32");

      const mutations = calls.filter(({ input, init }) => isRenewMutation(input, init));
      const keys = mutations.map(uuidHeader);
      expect(mutations).toHaveLength(2);
      expect(keys.every(isUuidV4)).toBeTrue();
      expect(new Set(keys).size).toBe(2);
      expect(mutations.every(({ init }) => init?.body === undefined)).toBeTrue();
    });

    it("allows stale success, error and finally zero writes after session, selection or unmount changes", async () => {
      const changes: Array<{ label: string; apply: () => Promise<void> }> = [
        { label: "actor", apply: () => rerender(session({ actorId: "actor-renew-02" })) },
        { label: "tenant", apply: () => rerender(session({ tenantId: "tenant-renew-02" })) },
        {
          label: "customer",
          apply: () => rerender(session({ customerId: "customer-renew-02" })),
        },
        {
          label: "environment",
          apply: () => rerender(session({ environment: alternateEnvironment(testEnvironment()) })),
        },
        {
          label: "expiresAt",
          apply: () => rerender(session({ expiresAt: "2099-08-01T01:00:00.000Z" })),
        },
        { label: "logout", apply: () => rerender(null) },
        {
          label: "selection",
          apply: async () => {
            await act(async () => {
              button("Owned Renew Two").props.onClick();
              await flush();
            });
          },
        },
        { label: "unmount", apply: unmount },
      ];

      for (const change of changes) {
        const pending = deferred<Response>();
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              renewableCard("card:renew.1", "4242", "Owned Renew One"),
              renewableCard("card:renew.2", "5252", "Owned Renew Two"),
            ]);
          }
          if (isRenewMutation(input, init)) {
            mutationReads += 1;
            return pending.promise;
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Renew card").props.onClick();
          await flush();
        });
        expect(mutationReads, change.label).toBe(1);
        await change.apply();
        await resolvePending(
          pending,
          json({
            ...renewableCard("card:renew.1", "4242", "Owned Renew One", {
              expiryMonth: 1,
              expiryYear: 2031,
            }),
            providerOperationId: providerSecret,
            traceId: traceSecret,
            internalId: internalSecret,
          }),
        );
        if (change.label === "selection") {
          await act(async () => {
            button("Owned Renew One").props.onClick();
            await flush();
          });
        }
        expect(pageText(), change.label).not.toContain("01/31");
        expect(body(), change.label).not.toMatch(
          /provider-create-secret|trace-create-secret|internal-create-secret/,
        );
        expect(mutationReads, change.label).toBe(1);
        await unmount();
      }

      const rejected = deferred<Response>();
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([renewableCard("card:renew.1", "4242", "Owned Renew Card")]);
        }
        if (isRenewMutation(input, init)) return rejected.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Renew card").props.onClick();
        await flush();
      });
      await rerender(session({ actorId: "actor-renew-error" }));
      await rejectPending(rejected, new Error(internalSecret));
      expect(pageText()).not.toContain("Card renewal failed");
      expect(body()).not.toContain(internalSecret);
    });

    it("does not expose renewal for an expired session or a Card without the capability", async () => {
      for (const mode of ["expired", "capability"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              renewableCard("card:renew.1", "4242", "Owned Renew Card", {
                ...(mode === "capability"
                  ? {
                      capabilities: {
                        freeze: true,
                        unfreeze: false,
                        replace: false,
                        renew: false,
                        updateLimits: true,
                      },
                    }
                  : {}),
              }),
            ]);
          }
          if (isRenewMutation(input, init)) {
            mutationReads += 1;
            return json({});
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount(
          mode === "expired" ? session({ expiresAt: "2026-07-31T00:00:00.000Z" }) : session(),
        );
        expect(pageText(), mode).not.toContain("Renew card");
        expect(mutationReads, mode).toBe(0);
        await unmount();
      }
    });

    it("rejects a substituted Card, non-forward expiry or changed original public version", async () => {
      for (const mode of ["card", "expiry", "last4", "capabilities"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([renewableCard("card:renew.1", "4242", "Owned Renew Card")]);
          }
          if (isRenewMutation(input, init)) {
            mutationReads += 1;
            return json(
              renewableCard(
                mode === "card" ? "card:foreign" : "card:renew.1",
                "4242",
                "Owned Renew Card",
                {
                  expiryMonth: mode === "expiry" ? 12 : 1,
                  expiryYear: mode === "expiry" ? 2030 : 2031,
                  ...(mode === "last4" ? { last4: "9999" } : {}),
                  ...(mode === "capabilities"
                    ? {
                        capabilities: {
                          freeze: true,
                          unfreeze: false,
                          replace: true,
                          renew: true,
                          updateLimits: true,
                        },
                      }
                    : {}),
                },
              ),
            );
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Renew card").props.onClick();
          await flush();
        });
        expect(mutationReads, mode).toBe(1);
        expect(pageText(), mode).toContain("Card renewal failed. Try again.");
        expect(pageText(), mode).not.toMatch(/9999|card:foreign|01\/31/);
        await act(flush);
        expect(mutationReads, mode).toBe(1);
        await unmount();
      }
    });

    it("does not retry failure or render Backend bodies, trace IDs and internal fields", async () => {
      let mutationReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([renewableCard("card:renew.1", "4242", "Owned Renew Card")]);
        }
        if (isRenewMutation(input, init)) {
          mutationReads += 1;
          return json({ message: internalSecret, provider: providerSecret }, 502, traceSecret);
        }
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Renew card").props.onClick();
        void button("Renew card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(pageText()).toContain("Card renewal failed. Try again.");
      expect(body()).not.toMatch(
        /internal-create-secret|provider-create-secret|trace-create-secret/,
      );
      await act(flush);
      expect(mutationReads).toBe(1);
    });
  },
);

describeConfigured(
  `Mounted selected Card replacement (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("uses one POST and fresh UUIDv4 per click, then atomically replaces and selects the new Card", async () => {
      const pending = [deferred<Response>(), deferred<Response>()];
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([replaceableCard("card:replace.1", "4242", "Owned Replace Card")]);
        }
        if (isReplaceMutation(input, init)) return pending[mutationReads++]!.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await setReplacementReason("STOLEN");

      await act(async () => {
        void button("Replace card").props.onClick();
        void button("Replace card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      await resolvePending(
        pending[0]!,
        json({
          ...replaceableCard("card:replacement.2", "9876", "Owned Replace Card", {
            expiryMonth: 1,
            expiryYear: 2033,
          }),
          providerOperationId: providerSecret,
          traceId: traceSecret,
          internalId: internalSecret,
        }),
      );
      expect(pageText()).toContain("9876");
      expect(pageText()).not.toContain("4242");
      expect(navigations).toEqual([{ search: { cardId: "card:replacement.2" }, replace: true }]);
      expect(body()).not.toMatch(
        /provider-create-secret|trace-create-secret|internal-create-secret/,
      );

      await setReplacementReason("DAMAGED");
      await act(async () => {
        void button("Replace card").props.onClick();
        void button("Replace card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      await resolvePending(
        pending[1]!,
        json(
          replaceableCard("card:replacement.3", "6789", "Owned Replace Card", {
            expiryMonth: 2,
            expiryYear: 2034,
          }),
        ),
      );
      expect(pageText()).toContain("6789");
      expect(pageText()).not.toContain("9876");
      expect(navigations.at(-1)).toEqual({
        search: { cardId: "card:replacement.3" },
        replace: true,
      });

      const mutations = calls.filter(({ input, init }) => isReplaceMutation(input, init));
      const keys = mutations.map(uuidHeader);
      expect(mutations).toHaveLength(2);
      expect(keys.every(isUuidV4)).toBeTrue();
      expect(new Set(keys).size).toBe(2);
      expect(mutations.map(({ init }) => JSON.parse(String(init?.body)))).toEqual([
        { reason: "STOLEN" },
        { reason: "DAMAGED" },
      ]);
    });

    it("allows stale success, error and finally zero writes after session, selection, reason or unmount changes", async () => {
      const changes: Array<{ label: string; apply: () => Promise<void> }> = [
        { label: "actor", apply: () => rerender(session({ actorId: "actor-replace-02" })) },
        { label: "tenant", apply: () => rerender(session({ tenantId: "tenant-replace-02" })) },
        {
          label: "customer",
          apply: () => rerender(session({ customerId: "customer-replace-02" })),
        },
        {
          label: "environment",
          apply: () => rerender(session({ environment: alternateEnvironment(testEnvironment()) })),
        },
        {
          label: "expiresAt",
          apply: () => rerender(session({ expiresAt: "2099-08-01T01:00:00.000Z" })),
        },
        { label: "logout", apply: () => rerender(null) },
        { label: "reason", apply: () => setReplacementReason("STOLEN") },
        {
          label: "selection",
          apply: async () => {
            await act(async () => {
              button("Owned Replace Two").props.onClick();
              await flush();
            });
          },
        },
        { label: "unmount", apply: unmount },
      ];

      for (const change of changes) {
        const pending = deferred<Response>();
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              replaceableCard("card:replace.1", "4242", "Owned Replace One"),
              replaceableCard("card:replace.2", "5252", "Owned Replace Two"),
            ]);
          }
          if (isReplaceMutation(input, init)) {
            mutationReads += 1;
            return pending.promise;
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Replace card").props.onClick();
          await flush();
        });
        expect(mutationReads, change.label).toBe(1);
        await change.apply();
        await resolvePending(
          pending,
          json({
            ...replaceableCard("card:replacement.stale", "9876", "Owned Replace One", {
              expiryMonth: 1,
              expiryYear: 2033,
            }),
            providerOperationId: providerSecret,
            traceId: traceSecret,
            internalId: internalSecret,
          }),
        );
        if (change.label === "selection") {
          await act(async () => {
            button("Owned Replace One").props.onClick();
            await flush();
          });
        }
        expect(pageText(), change.label).not.toContain("9876");
        expect(body(), change.label).not.toMatch(
          /provider-create-secret|trace-create-secret|internal-create-secret/,
        );
        expect(
          navigations.some(
            (navigation) =>
              (navigation.search as { cardId?: string } | undefined)?.cardId ===
              "card:replacement.stale",
          ),
          change.label,
        ).toBeFalse();
        expect(mutationReads, change.label).toBe(1);
        await unmount();
      }

      const rejected = deferred<Response>();
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([replaceableCard("card:replace.1", "4242", "Owned Replace Card")]);
        }
        if (isReplaceMutation(input, init)) return rejected.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Replace card").props.onClick();
        await flush();
      });
      await rerender(session({ actorId: "actor-replace-error" }));
      await rejectPending(rejected, new Error(internalSecret));
      expect(pageText()).not.toContain("Card replacement failed");
      expect(body()).not.toContain(internalSecret);
    });

    it("does not expose replacement for an expired session or a Card without capability", async () => {
      for (const mode of ["expired", "capability"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              replaceableCard("card:replace.1", "4242", "Owned Replace Card", {
                ...(mode === "capability"
                  ? {
                      capabilities: {
                        freeze: true,
                        unfreeze: false,
                        replace: false,
                        renew: false,
                        updateLimits: true,
                      },
                    }
                  : {}),
              }),
            ]);
          }
          if (isReplaceMutation(input, init)) {
            mutationReads += 1;
            return json({});
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount(
          mode === "expired" ? session({ expiresAt: "2026-07-31T00:00:00.000Z" }) : session(),
        );
        expect(pageText(), mode).not.toContain("Replace card");
        expect(mutationReads, mode).toBe(0);
        await unmount();
      }
    });

    it("rejects invalid or colliding replacements without changing the old Card or selection", async () => {
      for (const mode of ["old-id", "type", "currency", "alias", "last4", "collision"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              replaceableCard("card:replace.1", "4242", "Owned Replace Card"),
              replaceableCard("card:existing", "3131", "Existing Card"),
            ]);
          }
          if (isReplaceMutation(input, init)) {
            mutationReads += 1;
            return json(
              replaceableCard(
                mode === "old-id"
                  ? "card:replace.1"
                  : mode === "collision"
                    ? "card:existing"
                    : "card:replacement.2",
                mode === "last4" ? "99" : "9876",
                mode === "alias" ? "Foreign Alias" : "Owned Replace Card",
                {
                  expiryMonth: 1,
                  expiryYear: 2033,
                  ...(mode === "type" ? { type: "PHYSICAL" } : {}),
                  ...(mode === "currency" ? { currency: "EUR" } : {}),
                },
              ),
            );
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Replace card").props.onClick();
          await flush();
        });
        expect(mutationReads, mode).toBe(1);
        expect(pageText(), mode).toContain("Card replacement failed. Try again.");
        expect(pageText(), mode).toContain("4242");
        expect(pageText(), mode).not.toMatch(/9876|Foreign Alias/);
        expect(navigations, mode).toHaveLength(0);
        await act(flush);
        expect(mutationReads, mode).toBe(1);
        await unmount();
      }
    });

    it("does not retry failure or render Backend bodies, trace IDs and internal fields", async () => {
      let mutationReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([replaceableCard("card:replace.1", "4242", "Owned Replace Card")]);
        }
        if (isReplaceMutation(input, init)) {
          mutationReads += 1;
          return json({ message: internalSecret, provider: providerSecret }, 502, traceSecret);
        }
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Replace card").props.onClick();
        void button("Replace card").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(pageText()).toContain("Card replacement failed. Try again.");
      expect(body()).not.toMatch(
        /internal-create-secret|provider-create-secret|trace-create-secret/,
      );
      await act(flush);
      expect(mutationReads).toBe(1);
    });
  },
);

describeConfigured(
  `Mounted selected Card freeze and unfreeze (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("sends at most one mutation per click with a fresh UUIDv4 and strict action transition", async () => {
      const pending = [deferred<Response>(), deferred<Response>()];
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([card("card:status.1", "4242", "Owned Status Card")]);
        }
        const action = statusMutationAction(input, init);
        if (action) return pending[mutationReads++]!.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Freeze").props.onClick();
        void button("Freeze").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      await resolvePending(
        pending[0]!,
        json({
          ...statusCard("card:status.1", "freeze"),
          providerOperationId: providerSecret,
          traceId: traceSecret,
          internalId: internalSecret,
        }),
      );
      expect(pageText()).toContain("FROZEN");
      expect(body()).not.toMatch(
        /provider-create-secret|trace-create-secret|internal-create-secret/,
      );

      await act(async () => {
        void button("Unfreeze").props.onClick();
        void button("Unfreeze").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      await resolvePending(pending[1]!, json(statusCard("card:status.1", "unfreeze")));
      expect(pageText()).toContain("ACTIVE");

      const mutations = calls.filter(({ input, init }) => statusMutationAction(input, init));
      expect(mutations.map(({ input, init }) => statusMutationAction(input, init))).toEqual([
        "freeze",
        "unfreeze",
      ]);
      const keys = mutations.map(uuidHeader);
      expect(keys.every(isUuidV4)).toBeTrue();
      expect(new Set(keys).size).toBe(2);
      expect(mutations.every(({ init }) => init?.body === undefined)).toBeTrue();
    });

    it("allows stale success, error and finally zero writes after session, selection or unmount changes", async () => {
      const changes: Array<{ label: string; apply: () => Promise<void> }> = [
        { label: "actor", apply: () => rerender(session({ actorId: "actor-status-02" })) },
        { label: "tenant", apply: () => rerender(session({ tenantId: "tenant-status-02" })) },
        {
          label: "customer",
          apply: () => rerender(session({ customerId: "customer-status-02" })),
        },
        {
          label: "environment",
          apply: () => rerender(session({ environment: alternateEnvironment(testEnvironment()) })),
        },
        {
          label: "expiresAt",
          apply: () => rerender(session({ expiresAt: "2099-08-01T01:00:00.000Z" })),
        },
        { label: "logout", apply: () => rerender(null) },
        {
          label: "selection-action",
          apply: async () => {
            await act(async () => {
              button("Owned Frozen Two").props.onClick();
              await flush();
            });
          },
        },
        { label: "unmount", apply: unmount },
      ];

      for (const change of changes) {
        const pending = deferred<Response>();
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              card("card:status.1", "4242", "Owned Active One"),
              card("card:status.2", "5252", "Owned Frozen Two", {
                status: "FROZEN",
                capabilities: {
                  freeze: false,
                  unfreeze: true,
                  replace: false,
                  renew: false,
                  updateLimits: true,
                },
              }),
            ]);
          }
          if (statusMutationAction(input, init)) {
            mutationReads += 1;
            return pending.promise;
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Freeze").props.onClick();
          await flush();
        });
        expect(mutationReads, change.label).toBe(1);
        await change.apply();
        await resolvePending(
          pending,
          json({
            ...statusCard("card:status.1", "freeze", { alias: "Owned Active One" }),
            providerOperationId: providerSecret,
            traceId: traceSecret,
            internalId: internalSecret,
          }),
        );
        if (change.label === "selection-action") {
          await act(async () => {
            button("Owned Active One").props.onClick();
            await flush();
          });
        }
        expect(pageText(), change.label).not.toContain("FROZEN");
        expect(body(), change.label).not.toMatch(
          /provider-create-secret|trace-create-secret|internal-create-secret/,
        );
        expect(mutationReads, change.label).toBe(1);
        await unmount();
      }

      const rejected = deferred<Response>();
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([card("card:status.1", "4242", "Owned Status Card")]);
        }
        if (statusMutationAction(input, init)) return rejected.promise;
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Freeze").props.onClick();
        await flush();
      });
      await rerender(session({ actorId: "actor-status-error" }));
      await rejectPending(rejected, new Error(internalSecret));
      expect(pageText()).not.toContain("Card status update failed");
      expect(body()).not.toContain(internalSecret);
    });

    it("rejects a substituted Card, wrong action state or changed public Card version", async () => {
      for (const mode of ["card", "status", "version"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([card("card:status.1", "4242", "Owned Status Card")]);
          }
          if (statusMutationAction(input, init)) {
            mutationReads += 1;
            return json(
              statusCard(mode === "card" ? "card:foreign" : "card:status.1", "freeze", {
                ...(mode === "status" ? { status: "ACTIVE" } : {}),
                ...(mode === "version" ? { last4: "9999" } : {}),
              }),
            );
          }
          const publicRead = publicReadResponse(input);
          if (publicRead) return publicRead;
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await act(async () => {
          void button("Freeze").props.onClick();
          await flush();
        });
        expect(mutationReads, mode).toBe(1);
        expect(pageText(), mode).toContain("Card status update failed. Try again.");
        expect(pageText(), mode).not.toMatch(/9999|card:foreign/);
        await act(flush);
        expect(mutationReads, mode).toBe(1);
        await unmount();
      }
    });

    it("does not retry failure or render Backend bodies, trace IDs and internal fields", async () => {
      let mutationReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([card("card:status.1", "4242", "Owned Status Card")]);
        }
        if (statusMutationAction(input, init)) {
          mutationReads += 1;
          return json({ message: internalSecret, provider: providerSecret }, 502, traceSecret);
        }
        const publicRead = publicReadResponse(input);
        if (publicRead) return publicRead;
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await act(async () => {
        void button("Freeze").props.onClick();
        void button("Freeze").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(pageText()).toContain("Card status update failed. Try again.");
      expect(body()).not.toMatch(
        /internal-create-secret|provider-create-secret|trace-create-secret/,
      );
      await act(flush);
      expect(mutationReads).toBe(1);
    });
  },
);

describeConfigured(
  `Mounted selected Card limits update (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("sends one allowlisted mutation with a fresh UUIDv4 per manual submit and synchronously locks double clicks", async () => {
      const pending = [deferred<Response>(), deferred<Response>()];
      const owned = card("card:limits.1", "4242", "Owned Limits Card");
      let mutationReads = 0;
      const calls = installFetch((input, init) => {
        if (isCardList(input)) return cardPage([owned]);
        if (isLimitsMutation(input, init)) return pending[mutationReads++]!.promise;
        const balanceCardId = selectedCardId(input, "balance");
        if (balanceCardId) return json(balance(balanceCardId));
        const limitsCardId = selectedCardId(input, "limits");
        if (limitsCardId) return json(mutableLimits(limitsCardId));
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await setLimit("Single transaction", "12000");
      await setLimit("Daily spend", "60000");
      await setLimit("Monthly spend", "600000");
      await setLimit("Daily ATM", "25000");

      await act(async () => {
        void button("Apply limits").props.onClick();
        void button("Apply limits").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      await resolvePending(
        pending[0]!,
        json({
          ...mutableLimits("card:limits.1", {
            singleTransactionMinor: "12000",
            dailySpendMinor: "60000",
            monthlySpendMinor: "600000",
            dailyAtmMinor: "25000",
            updatedAt: "2026-08-01T00:00:00Z",
          }),
          providerOperationId: providerSecret,
          traceId: traceSecret,
          secret: internalSecret,
        }),
      );
      expect(pageText()).toContain("600000");
      expect(body()).not.toMatch(
        /provider-create-secret|trace-create-secret|internal-create-secret/,
      );

      await setLimit("Daily spend", "70000");
      await setLimit("Monthly spend", "700000");
      await act(async () => {
        void button("Apply limits").props.onClick();
        void button("Apply limits").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(2);
      await resolvePending(
        pending[1]!,
        json(
          mutableLimits("card:limits.1", {
            singleTransactionMinor: "12000",
            dailySpendMinor: "70000",
            monthlySpendMinor: "700000",
            dailyAtmMinor: "25000",
            updatedAt: "2026-08-01T00:01:00Z",
          }),
        ),
      );

      const mutations = calls.filter(({ input, init }) => isLimitsMutation(input, init));
      const keys = mutations.map(uuidHeader);
      expect(keys.every(isUuidV4)).toBeTrue();
      expect(new Set(keys).size).toBe(2);
      expect(JSON.parse(String(mutations[0]?.init?.body))).toEqual({
        singleTransactionMinor: 12000,
        dailySpendMinor: 60000,
        monthlySpendMinor: 600000,
        dailyAtmMinor: 25000,
      });
      expect(Object.keys(JSON.parse(String(mutations[0]?.init?.body))).sort()).toEqual(
        ["singleTransactionMinor", "dailySpendMinor", "monthlySpendMinor", "dailyAtmMinor"].sort(),
      );
    });

    it("rejects non-integer, unsafe, over-limit and inconsistent input before any mutation", async () => {
      for (const invalid of ["-1", "1.5", "01", "9000000000001", "9007199254740992", "5000"]) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([card("card:limits.1", "4242", "Owned Limits Card")]);
          }
          if (isLimitsMutation(input, init)) {
            mutationReads += 1;
            return json({});
          }
          const balanceCardId = selectedCardId(input, "balance");
          if (balanceCardId) return json(balance(balanceCardId));
          const limitsCardId = selectedCardId(input, "limits");
          if (limitsCardId) return json(mutableLimits(limitsCardId));
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await setLimit("Daily spend", invalid);
        await act(async () => {
          void button("Apply limits").props.onClick();
          void button("Apply limits").props.onClick();
          await flush();
        });
        expect(mutationReads, invalid).toBe(0);
        expect(pageText(), invalid).toContain(
          "Card limits update failed. Check the values and try again.",
        );
        await unmount();
      }
    });

    it("allows late success, error and finally zero writes after scope, selection, input or unmount changes", async () => {
      const changes: Array<{
        label: string;
        apply: () => Promise<void>;
      }> = [
        { label: "actor", apply: () => rerender(session({ actorId: "actor-limits-02" })) },
        { label: "tenant", apply: () => rerender(session({ tenantId: "tenant-limits-02" })) },
        {
          label: "customer",
          apply: () => rerender(session({ customerId: "customer-limits-02" })),
        },
        {
          label: "environment",
          apply: () => rerender(session({ environment: alternateEnvironment(testEnvironment()) })),
        },
        {
          label: "expiresAt",
          apply: () => rerender(session({ expiresAt: "2099-08-01T01:00:00.000Z" })),
        },
        { label: "logout", apply: () => rerender(null) },
        {
          label: "selection",
          apply: async () => {
            await act(async () => {
              button("Owned Limits Two").props.onClick();
              await flush();
            });
          },
        },
        { label: "input", apply: () => setLimit("Daily spend", "70000") },
        { label: "unmount", apply: unmount },
      ];

      for (const change of changes) {
        const pending = deferred<Response>();
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([
              card("card:limits.1", "4242", "Owned Limits One"),
              card("card:limits.2", "5252", "Owned Limits Two"),
            ]);
          }
          if (isLimitsMutation(input, init)) {
            mutationReads += 1;
            return pending.promise;
          }
          const balanceCardId = selectedCardId(input, "balance");
          if (balanceCardId) return json(balance(balanceCardId));
          const limitsCardId = selectedCardId(input, "limits");
          if (limitsCardId) return json(mutableLimits(limitsCardId));
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await setLimit("Single transaction", "12000");
        await setLimit("Daily spend", "60000");
        await setLimit("Monthly spend", "600000");
        await setLimit("Daily ATM", "25000");
        await act(async () => {
          void button("Apply limits").props.onClick();
          await flush();
        });
        expect(mutationReads, change.label).toBe(1);
        await change.apply();
        await resolvePending(
          pending,
          json({
            ...mutableLimits("card:limits.1", {
              singleTransactionMinor: "12000",
              dailySpendMinor: "60000",
              monthlySpendMinor: "600000",
              dailyAtmMinor: "25000",
              updatedAt: "2098-01-01T00:00:00Z",
            }),
            providerOperationId: providerSecret,
            traceId: traceSecret,
            internalId: internalSecret,
          }),
        );
        expect(pageText(), change.label).not.toContain("2098");
        expect(body(), change.label).not.toMatch(
          /provider-create-secret|trace-create-secret|internal-create-secret/,
        );
        expect(mutationReads, change.label).toBe(1);
        await unmount();
      }

      const rejected = deferred<Response>();
      let rejectedMutations = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([card("card:limits.1", "4242", "Owned Limits Card")]);
        }
        if (isLimitsMutation(input, init)) {
          rejectedMutations += 1;
          return rejected.promise;
        }
        const balanceCardId = selectedCardId(input, "balance");
        if (balanceCardId) return json(balance(balanceCardId));
        const limitsCardId = selectedCardId(input, "limits");
        if (limitsCardId) return json(mutableLimits(limitsCardId));
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await setLimit("Daily spend", "60000");
      await setLimit("Monthly spend", "600000");
      await act(async () => {
        void button("Apply limits").props.onClick();
        await flush();
      });
      await setLimit("Daily spend", "70000");
      await rejectPending(rejected, new Error(internalSecret));
      expect(rejectedMutations).toBe(1);
      expect(pageText()).not.toContain("Card limits update failed");
      expect(body()).not.toContain(internalSecret);
    });

    it("binds the response to the current selected Card and exact submitted values", async () => {
      for (const mode of ["wrong-card", "wrong-value"] as const) {
        let mutationReads = 0;
        installFetch((input, init) => {
          if (isCardList(input)) {
            return cardPage([card("card:limits.1", "4242", "Owned Limits Card")]);
          }
          if (isLimitsMutation(input, init)) {
            mutationReads += 1;
            return json(
              mutableLimits(mode === "wrong-card" ? "card:limits.2" : "card:limits.1", {
                singleTransactionMinor: "12000",
                dailySpendMinor: mode === "wrong-value" ? "60001" : "60000",
                monthlySpendMinor: "600000",
                dailyAtmMinor: "25000",
                updatedAt: "2026-08-01T00:00:00Z",
              }),
            );
          }
          const balanceCardId = selectedCardId(input, "balance");
          if (balanceCardId) return json(balance(balanceCardId));
          const limitsCardId = selectedCardId(input, "limits");
          if (limitsCardId) return json(mutableLimits(limitsCardId));
          throw new Error(`Unexpected request ${String(input)}`);
        });
        await mount();
        await setLimit("Single transaction", "12000");
        await setLimit("Daily spend", "60000");
        await setLimit("Monthly spend", "600000");
        await setLimit("Daily ATM", "25000");
        await act(async () => {
          void button("Apply limits").props.onClick();
          await flush();
        });
        expect(mutationReads, mode).toBe(1);
        expect(pageText(), mode).toContain(
          "Card limits update failed. Check the values and try again.",
        );
        await act(flush);
        expect(mutationReads, mode).toBe(1);
        await unmount();
      }
    });

    it("never retries a failed mutation or renders Backend error bodies and trace IDs", async () => {
      let mutationReads = 0;
      installFetch((input, init) => {
        if (isCardList(input)) {
          return cardPage([card("card:limits.1", "4242", "Owned Limits Card")]);
        }
        if (isLimitsMutation(input, init)) {
          mutationReads += 1;
          return json({ message: internalSecret, provider: providerSecret }, 502, traceSecret);
        }
        const balanceCardId = selectedCardId(input, "balance");
        if (balanceCardId) return json(balance(balanceCardId));
        const limitsCardId = selectedCardId(input, "limits");
        if (limitsCardId) return json(mutableLimits(limitsCardId));
        throw new Error(`Unexpected request ${String(input)}`);
      });
      await mount();
      await setLimit("Daily spend", "60000");
      await setLimit("Monthly spend", "600000");
      await act(async () => {
        void button("Apply limits").props.onClick();
        void button("Apply limits").props.onClick();
        await flush();
      });
      expect(mutationReads).toBe(1);
      expect(pageText()).toContain("Card limits update failed. Check the values and try again.");
      expect(body()).not.toMatch(
        /internal-create-secret|provider-create-secret|trace-create-secret/,
      );
      await act(flush);
      expect(mutationReads).toBe(1);
    });
  },
);
