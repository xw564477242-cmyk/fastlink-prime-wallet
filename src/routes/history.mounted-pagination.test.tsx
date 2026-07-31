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

const originalFetch = globalThis.fetch;
const traceSecret = "trace-secret-must-not-render";
const providerSecret = "provider-secret-must-not-render";
const journalSecret = "journal-secret-must-not-render";
const walletSecret = "wallet-secret-must-not-render";
const internalSecret = "internal-secret-must-not-render";
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let HistoryPage: () => ReactElement;

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
    throw new Error("Mounted Card transaction test requires SANDBOX or TEST with /api");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-history-mounted-01",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-history-mounted-01",
    customerId: "customer-history-mounted-01",
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
    alias: `Mounted ${last4}`,
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

function transaction(id: string, merchant = "Mounted Coffee") {
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

function json(value: unknown, status = 200, traceId = "safe-http-trace"): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": traceId },
  });
}

function page(transactions: unknown[], nextCursor: unknown): Response {
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

function isTransactionRead(input: string | URL | Request): boolean {
  return String(input).includes("/transactions?");
}

function body(): string {
  return JSON.stringify(renderer?.toJSON() ?? null);
}

function pageText(): string {
  if (!renderer) return "";
  return renderedText(renderer.root);
}

function renderedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join("");
  if (value && typeof value === "object" && "children" in value) {
    return renderedText((value as ReactTestInstance).children);
  }
  return "";
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

async function mount(currentSession: BackendSession | null = session()) {
  sessionState = { checking: false, session: currentSession, error: null };
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
    createFileRoute: () => (configuration: unknown) => configuration,
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useRouterState: () => "/history",
  }));
  ({ HistoryPage } = await import("./history"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted Card transaction pagination (${configuredEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("runs one GET per manual page, forwards the opaque cursor exactly and keeps filtering bound", async () => {
      const nextPage = deferred<Response>();
      const opaque = cursor("mounted-page-2");
      let transactionReads = 0;
      const calls = installFetch((input) => {
        if (isCardList(input)) {
          return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
        }
        transactionReads += 1;
        return transactionReads === 1
          ? page([transaction("transaction:page.1")], opaque)
          : nextPage.promise;
      });
      await mount();
      expect(pageText()).toContain("Mounted Coffee");

      const search = renderer?.root.findByType("input");
      await act(async () => {
        search?.props.onChange({ target: { value: "coffee" } });
        void button("Load more transactions").props.onClick();
        void button("Load more transactions").props.onClick();
        await flush();
      });
      expect(transactionReads).toBe(2);
      const secondRead = calls.filter(({ input }) => isTransactionRead(input))[1];
      const url = new URL(String(secondRead?.input), "https://wallet.invalid");
      expect(url.searchParams.get("cursor")).toBe(opaque);
      expect(url.searchParams.get("limit")).toBe("25");

      await resolvePending(
        nextPage,
        page([transaction("transaction:page.2", "Mounted Tea")], null),
      );
      expect(pageText()).toContain("Mounted Coffee");
      expect(pageText()).not.toContain("Mounted Tea");
      expect(body()).not.toContain(opaque);
    });

    it("synchronously clears old rows, cursor, error and loading for every scope change", async () => {
      const changes: Array<
        { label: string; next: BackendSession } | { label: "cardId"; selectCard: true }
      > = [
        { label: "actor", next: session({ actorId: "actor-history-mounted-02" }) },
        { label: "tenant", next: session({ tenantId: "tenant-history-mounted-02" }) },
        { label: "customer", next: session({ customerId: "customer-history-mounted-02" }) },
        {
          label: "environment",
          next: session({ environment: alternateEnvironment(testEnvironment()) }),
        },
        { label: "expiresAt", next: session({ expiresAt: "2099-08-01T01:00:00.000Z" }) },
        { label: "cardId", selectCard: true },
      ];

      for (const change of changes) {
        const stalePage = deferred<Response>();
        const newRead = deferred<Response>();
        let transactionReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            return json({
              cards: [card("card:owned.1", "4242"), card("card:owned.2", "5252")],
              nextCursor: null,
            });
          }
          transactionReads += 1;
          if (transactionReads === 1) {
            return page(
              [transaction("transaction:old.scope", "Old Scope Merchant")],
              cursor("old-next"),
            );
          }
          return transactionReads === 2 ? stalePage.promise : newRead.promise;
        });
        await mount();
        await act(async () => {
          void button("Load more transactions").props.onClick();
          await flush();
        });
        expect(body()).toContain("Loading more");

        if ("selectCard" in change) {
          await act(async () => {
            button("Mounted 5252").props.onClick();
            await flush();
          });
        } else {
          await updateSession(change.next);
        }
        expect(pageText(), change.label).not.toContain("Old Scope Merchant");
        expect(body(), change.label).not.toContain("Loading more");
        expect(body(), change.label).not.toContain("Load more transactions");

        await resolvePending(
          stalePage,
          page(
            [transaction("transaction:stale.success", "Stale Success Merchant")],
            cursor("stale-next"),
          ),
        );
        expect(pageText(), change.label).not.toContain("Stale Success Merchant");
        expect(body(), change.label).not.toContain("stale-next");
        await unmount();
      }

      const replacementRead = deferred<Response>();
      let errorReads = 0;
      installFetch((input) => {
        if (isCardList(input)) {
          return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
        }
        errorReads += 1;
        return errorReads === 1
          ? json({ message: internalSecret }, 403, traceSecret)
          : replacementRead.promise;
      });
      await mount();
      expect(pageText()).toContain("Card transactions are unavailable");
      await updateSession(session({ actorId: "actor-history-mounted-error-cleared" }));
      expect(pageText()).not.toContain("Card transactions are unavailable");
      expect(body()).not.toMatch(/internal-secret|trace-secret/);
      await resolvePending(replacementRead, page([], null));
    });

    it("fails closed for expired, mismatched, unauthorized and stale cursor reads without retry", async () => {
      for (const invalidSession of [
        session({ expiresAt: "2020-08-01T00:00:00.000Z" }),
        session({ environment: alternateEnvironment(testEnvironment()) }),
      ]) {
        let transactionReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
          }
          transactionReads += 1;
          return page([], null);
        });
        await mount(invalidSession);
        expect(transactionReads).toBe(0);
        expect(body()).not.toContain(traceSecret);
        await unmount();
      }

      for (const status of [400, 403, 410]) {
        let transactionReads = 0;
        installFetch((input) => {
          if (isCardList(input)) {
            return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
          }
          transactionReads += 1;
          return transactionReads === 1
            ? page([transaction("transaction:accepted")], cursor(`status-${status}`))
            : json(
                { message: internalSecret, providerCursor: providerSecret },
                status,
                traceSecret,
              );
        });
        await mount();
        await act(async () => {
          void button("Load more transactions").props.onClick();
          await flush();
        });
        expect(transactionReads).toBe(2);
        expect(body()).not.toMatch(/internal-secret|provider-secret|trace-secret/);
        expect(body()).not.toContain("Load more transactions");
        await act(flush);
        expect(transactionReads).toBe(2);
        await unmount();
      }
    });

    it("rejects repeated and non-canonical cursors before rendering or another unsafe page", async () => {
      const canonical = cursor("repeat");
      let reads = 0;
      installFetch((input) => {
        if (isCardList(input)) {
          return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
        }
        reads += 1;
        return reads === 1
          ? page([transaction("transaction:repeat.1", "Repeat First")], canonical)
          : page([transaction("transaction:repeat.2", "Repeat Second")], canonical);
      });
      await mount();
      await act(async () => {
        void button("Load more transactions").props.onClick();
        await flush();
      });
      expect(reads).toBe(2);
      expect(pageText()).not.toContain("Repeat Second");
      expect(body()).not.toContain("Load more transactions");
      await unmount();

      const signature = Buffer.alloc(32, 1).toString("base64url");
      const finalAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      const finalIndex = finalAlphabet.indexOf(signature.at(-1) ?? "");
      const nonCanonical = `${cursor("noncanonical").split(".")[0]}.${signature.slice(0, -1)}${finalAlphabet[finalIndex + 1]}`;
      expect(Buffer.from(nonCanonical.split(".")[1]!, "base64url")).toEqual(
        Buffer.from(signature, "base64url"),
      );
      installFetch((input) =>
        isCardList(input)
          ? json({ cards: [card("card:owned.1", "4242")], nextCursor: null })
          : page([transaction("transaction:noncanonical", "Noncanonical Merchant")], nonCanonical),
      );
      await mount();
      expect(pageText()).not.toContain("Noncanonical Merchant");
      expect(body()).not.toContain(nonCanonical);
    });

    it("accepts exactly 13 upstream fields but renders no Provider, wallet, journal, trace or secret", async () => {
      const forbidden = {
        providerPayload: providerSecret,
        providerTransactionId: providerSecret,
        walletRef: walletSecret,
        journalIds: [journalSecret],
        secret: internalSecret,
      };
      const cases = Object.entries(forbidden);
      for (const [field, value] of cases) {
        installFetch((input) =>
          isCardList(input)
            ? json({ cards: [card("card:owned.1", "4242")], nextCursor: null })
            : page(
                [
                  {
                    ...transaction("transaction:forbidden", "Forbidden Merchant"),
                    [field]: value,
                  },
                ],
                null,
              ),
        );
        await mount();
        expect(pageText(), field).not.toContain("Forbidden Merchant");
        expect(body(), field).not.toContain(String(value));
        await unmount();
      }

      installFetch((input) =>
        isCardList(input)
          ? json({ cards: [card("card:owned.1", "4242")], nextCursor: null })
          : page([transaction("transaction:exact.13")], null),
      );
      await mount();
      expect(Object.keys(transaction("transaction:exact.13"))).toHaveLength(13);
      expect(pageText()).toContain("Mounted Coffee");
      expect(pageText()).toContain("2500 USD minor units");
      expect(body()).not.toMatch(/provider-secret|wallet-secret|journal-secret|trace-secret/);
    });

    it("ignores stale page error and finally after scope change with zero pollution", async () => {
      const stalePage = deferred<Response>();
      let transactionReads = 0;
      installFetch((input) => {
        if (isCardList(input)) {
          return json({ cards: [card("card:owned.1", "4242")], nextCursor: null });
        }
        transactionReads += 1;
        return transactionReads === 1
          ? page(
              [transaction("transaction:accepted", "Accepted Before Scope Change")],
              cursor("stale-error"),
            )
          : stalePage.promise;
      });
      await mount();
      await act(async () => {
        void button("Load more transactions").props.onClick();
        await flush();
      });
      await updateSession(session({ actorId: "actor-history-mounted-02" }));
      await rejectPending(stalePage, new Error(internalSecret));
      expect(pageText()).not.toContain("Accepted Before Scope Change");
      expect(body()).not.toMatch(/internal-secret|Loading more/);
    });
  },
);
