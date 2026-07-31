import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { Buffer } from "node:buffer";
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

type HistoryRoute = {
  validateSearch?: (search: Record<string, unknown>) => { cardId?: string };
};

const originalFetch = globalThis.fetch;
const traceSecret = "trace-selection-secret-must-not-render";
const providerSecret = "provider-selection-secret-must-not-render";
const walletSecret = "wallet-selection-secret-must-not-render";
const journalSecret = "journal-selection-secret-must-not-render";
const internalSecret = "internal-selection-secret-must-not-render";
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let searchState: { cardId?: string } = {};
let HistoryPage: () => ReactElement;
let HistoryRoute: HistoryRoute;

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
    throw new Error("Mounted Card selection test requires SANDBOX or TEST with /api");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-history-selection-01",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-history-selection-01",
    customerId: "customer-history-selection-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function card(id: string, last4: string) {
  return {
    id,
    type: "VIRTUAL",
    status: "ACTIVE",
    last4,
    expiryMonth: 12,
    expiryYear: 2030,
    currency: "USD",
    alias: `Selection ${last4}`,
    availableBalanceMinor: "10000",
    capabilities: {
      freeze: true,
      unfreeze: false,
      replace: true,
      renew: false,
      updateLimits: true,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function transaction(id: string, merchant: string) {
  return {
    id,
    status: "SETTLED",
    amountMinor: "2500",
    authorizedAmountMinor: "2500",
    clearedAmountMinor: "2500",
    settledAmountMinor: "2500",
    reversedAmountMinor: "0",
    refundedAmountMinor: "0",
    currency: "USD",
    traceId: traceSecret,
    merchantName: merchant,
    merchantCategory: "5812",
    occurredAt: "2026-08-01T00:00:00.000Z",
  };
}

function cursor(label: string): string {
  return `${Buffer.from(JSON.stringify({ label }), "utf8").toString("base64url")}.${Buffer.alloc(32, label.length).toString("base64url")}`;
}

function json(value: unknown, status = 200, traceId = "safe-selection-trace"): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": traceId },
  });
}

function cardPage(cards: unknown[], nextCursor: unknown = null): Response {
  return json({ cards, nextCursor });
}

function transactionPage(transactions: unknown[], nextCursor: unknown = null): Response {
  return json({ transactions, nextCursor });
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

function isCardList(input: string | URL | Request): boolean {
  return String(input).includes("/v1/cards?");
}

function transactionCardId(input: string | URL | Request): string | null {
  const match = String(input).match(/\/v1\/cards\/([^/]+)\/transactions\?/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

function body(): string {
  return JSON.stringify(renderer?.toJSON() ?? null);
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

function button(label: string): ReactTestInstance {
  if (!renderer) throw new Error("History page is not mounted");
  const match = renderer.root
    .findAllByType("button")
    .find((candidate) => renderedText(candidate).includes(label));
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession | null = session(), cardId?: string) {
  sessionState = { checking: false, session: currentSession, error: null };
  searchState = cardId ? { cardId } : {};
  await act(async () => {
    renderer = create(createElement(HistoryPage));
    await flush();
  });
}

async function updateSession(currentSession: BackendSession | null) {
  if (!renderer) throw new Error("History page is not mounted");
  sessionState = { ...sessionState, session: currentSession };
  await act(async () => {
    renderer?.update(createElement(HistoryPage));
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
    useLang: () => ({ lang: "en", t: (key: string) => key }),
  }));
  mock.module("@tanstack/react-router", () => ({
    createFileRoute: () => (configuration: HistoryRoute) => ({
      ...configuration,
      useSearch: () => searchState,
    }),
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useRouterState: () => "/history",
  }));
  const history = await import("./history");
  HistoryPage = history.HistoryPage;
  HistoryRoute = history.Route as unknown as HistoryRoute;
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  searchState = {};
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted Card list to History selection (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("selects an owned deep-linked Card only after membership is proven and rejects hostile query shapes", async () => {
      expect(HistoryRoute.validateSearch?.({ cardId: ["card:foreign"] })).toEqual({});
      expect(HistoryRoute.validateSearch?.({ cardId: { value: "card:foreign" } })).toEqual({});

      const transactionCards: string[] = [];
      installFetch((input) => {
        if (isCardList(input)) {
          return cardPage([card("card:owned.1", "4242"), card("card:owned.2", "5252")]);
        }
        const selected = transactionCardId(input);
        if (selected) transactionCards.push(selected);
        return transactionPage([
          transaction(
            `transaction:${selected ?? "unknown"}`,
            selected === "card:owned.2" ? "Owned Two Merchant" : "Owned One Merchant",
          ),
        ]);
      });
      await mount(session(), "card:owned.2");
      expect(transactionCards).toEqual(["card:owned.2"]);
      expect(pageText()).toContain("Owned Two Merchant");
      expect(pageText()).not.toContain("Owned One Merchant");
      await unmount();

      transactionCards.length = 0;
      await mount(session(), "card:foreign");
      expect(transactionCards).toEqual(["card:owned.1"]);
      expect(transactionCards).not.toContain("card:foreign");
      expect(body()).not.toContain("card:foreign");
    });

    it("clears the old Card and transactions on selection and ignores stale page success, error and finally", async () => {
      for (const completion of ["success", "error"] as const) {
        const stalePage = deferred<Response>();
        const selectedRead = deferred<Response>();
        let transactionReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            return cardPage([card("card:owned.1", "4242"), card("card:owned.2", "5252")]);
          }
          transactionReads += 1;
          if (transactionReads === 1) {
            return transactionPage(
              [transaction("transaction:old", "Old Selected Merchant")],
              cursor(`stale-${completion}`),
            );
          }
          return transactionReads === 2 ? stalePage.promise : selectedRead.promise;
        });
        await mount();
        await act(async () => {
          void button("Load more transactions").props.onClick();
          await flush();
        });
        await act(async () => {
          button("Selection 5252").props.onClick();
          await flush();
        });
        expect(pageText()).not.toContain("Old Selected Merchant");
        expect(body()).not.toMatch(/Loading more|Load more transactions/);

        if (completion === "success") {
          await resolvePending(
            stalePage,
            transactionPage([transaction("transaction:stale", "Stale Selection Merchant")]),
          );
        } else {
          await rejectPending(stalePage, new Error(internalSecret));
        }
        expect(pageText()).not.toContain("Stale Selection Merchant");
        expect(body()).not.toMatch(/internal-selection-secret|trace-selection-secret/);
        await resolvePending(
          selectedRead,
          transactionPage([transaction("transaction:new", "New Selected Merchant")]),
        );
        expect(pageText()).toContain("New Selected Merchant");
        expect(pageText()).toContain("•••• 5252");
        await unmount();
      }
    });

    it("never issues an old-Card read after identity, expiry, environment or logout changes", async () => {
      const changes: Array<{ label: string; next: BackendSession | null }> = [
        { label: "actor", next: session({ actorId: "actor-history-selection-02" }) },
        { label: "tenant", next: session({ tenantId: "tenant-history-selection-02" }) },
        { label: "customer", next: session({ customerId: "customer-history-selection-02" }) },
        {
          label: "environment",
          next: session({ environment: alternateEnvironment(testEnvironment()) }),
        },
        { label: "expiresAt", next: session({ expiresAt: "2099-08-01T01:00:00.000Z" }) },
        { label: "logout", next: null },
      ];

      for (const change of changes) {
        const nextList = deferred<Response>();
        const transactionCards: string[] = [];
        let listReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            listReads += 1;
            return listReads === 1 ? cardPage([card("card:old-owned", "4242")]) : nextList.promise;
          }
          const selected = transactionCardId(input);
          if (selected) transactionCards.push(selected);
          return transactionPage([
            transaction(`transaction:${selected ?? "unknown"}`, "Old Scope Merchant"),
          ]);
        });
        await mount();
        expect(transactionCards).toEqual(["card:old-owned"]);
        await updateSession(change.next);
        expect(pageText(), change.label).not.toContain("Selection 4242");
        expect(pageText(), change.label).not.toContain("Old Scope Merchant");
        expect(transactionCards, change.label).toEqual(["card:old-owned"]);
        if (change.next && change.next.environment === testEnvironment()) {
          await resolvePending(nextList, cardPage([]));
        }
        await unmount();
      }
    });

    it("ignores stale Card-list page success, error and finally after an authenticated refresh", async () => {
      for (const completion of ["success", "error"] as const) {
        const staleListPage = deferred<Response>();
        const currentList = deferred<Response>();
        let listReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            listReads += 1;
            if (listReads === 1) {
              return cardPage([card("card:old-owned", "4242")], "old_list_cursor");
            }
            return listReads === 2 ? staleListPage.promise : currentList.promise;
          }
          const selected = transactionCardId(input);
          return transactionPage([
            transaction(
              `transaction:${selected ?? "unknown"}`,
              selected === "card:new-owned" ? "Current List Merchant" : "Old List Merchant",
            ),
          ]);
        });
        await mount();
        await act(async () => {
          void button("More Cards").props.onClick();
          await flush();
        });
        await updateSession(session({ actorId: "actor-history-selection-refreshed" }));
        expect(pageText()).not.toMatch(/Selection 4242|Old List Merchant/);

        if (completion === "success") {
          await resolvePending(staleListPage, cardPage([card("card:stale-owned", "9999")]));
        } else {
          await rejectPending(staleListPage, new Error(internalSecret));
        }
        expect(pageText()).not.toContain("Selection 9999");
        expect(body()).not.toMatch(/internal-selection-secret|trace-selection-secret/);

        await resolvePending(currentList, cardPage([card("card:new-owned", "5252")]));
        expect(pageText()).toContain("Selection 5252");
        expect(pageText()).toContain("Current List Merchant");
        expect(listReads).toBe(3);
        await unmount();
      }
    });

    it("allows only one manual Card page GET, forwards its cursor exactly and never retries", async () => {
      const nextCards = deferred<Response>();
      const opaque = "next_cards_cursor";
      let listReads = 0;
      const calls = installFetch((input) => {
        if (isCardList(input)) {
          listReads += 1;
          return listReads === 1
            ? cardPage([card("card:owned.1", "4242")], opaque)
            : nextCards.promise;
        }
        return transactionPage([transaction("transaction:one", "One Merchant")]);
      });
      await mount();
      await act(async () => {
        void button("More Cards").props.onClick();
        void button("More Cards").props.onClick();
        await flush();
      });
      expect(listReads).toBe(2);
      const secondList = calls.filter(({ input }) => isCardList(input))[1];
      expect(
        new URL(String(secondList?.input), "https://wallet.invalid").searchParams.get("cursor"),
      ).toBe(opaque);
      await resolvePending(nextCards, cardPage([card("card:owned.2", "5252")]));
      expect(pageText()).toContain("Selection 5252");
      await act(flush);
      expect(listReads).toBe(2);
      await unmount();

      listReads = 0;
      installFetch((input) => {
        if (isCardList(input)) {
          listReads += 1;
          return json({ message: internalSecret }, 403, traceSecret);
        }
        throw new Error("transaction read must not run");
      });
      await mount();
      expect(listReads).toBe(1);
      expect(body()).not.toMatch(/internal-selection-secret|trace-selection-secret/);
      await act(flush);
      expect(listReads).toBe(1);
    });

    it("renders only the 13-field public transaction contract after an owned Card selection", async () => {
      const forbidden = {
        providerPayload: providerSecret,
        providerTransactionId: providerSecret,
        walletRef: walletSecret,
        journalIds: [journalSecret],
        secret: internalSecret,
      };
      for (const [field, value] of Object.entries(forbidden)) {
        installFetch((input) =>
          isCardList(input)
            ? cardPage([card("card:owned.2", "5252")])
            : transactionPage([
                {
                  ...transaction("transaction:forbidden", "Forbidden Selection Merchant"),
                  [field]: value,
                },
              ]),
        );
        await mount(session(), "card:owned.2");
        expect(pageText(), field).not.toContain("Forbidden Selection Merchant");
        expect(body(), field).not.toContain(String(value));
        await unmount();
      }

      installFetch((input) =>
        isCardList(input)
          ? cardPage([card("card:owned.2", "5252")])
          : transactionPage([transaction("transaction:exact-13", "Exact Selection Merchant")]),
      );
      await mount(session(), "card:owned.2");
      expect(
        Object.keys(transaction("transaction:exact-13", "Exact Selection Merchant")),
      ).toHaveLength(13);
      expect(pageText()).toContain("Exact Selection Merchant");
      expect(body()).not.toMatch(
        /provider-selection-secret|wallet-selection-secret|journal-selection-secret|trace-selection-secret/,
      );
    });
  },
);
