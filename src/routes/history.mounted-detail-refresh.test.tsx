import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type SessionState = {
  checking: boolean;
  session: BackendSession | null;
  error: string | null;
};

const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let HistoryPage: () => ReactElement;
const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("History detail mounted test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(): BackendSession {
  return {
    actorId: "actor-page-detail",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-page-detail",
    customerId: "customer-page-detail",
    environment: environment(),
  };
}

function card() {
  return {
    id: "card:owned.1",
    type: "VIRTUAL",
    status: "ACTIVE",
    last4: "4242",
    expiryMonth: 12,
    expiryYear: 2030,
    currency: "USD",
    alias: "Detail Card",
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

function transaction(
  merchantName = "List Snapshot Merchant",
  status = "SETTLED",
  amountMinor = "2500",
) {
  return {
    id: "transaction:detail.1",
    status,
    amountMinor,
    authorizedAmountMinor: amountMinor,
    clearedAmountMinor: amountMinor,
    settledAmountMinor: amountMinor,
    reversedAmountMinor: "0",
    refundedAmountMinor: "0",
    currency: "USD",
    traceId: "trace-detail-page-must-not-render",
    merchantName,
    merchantCategory: "5812",
    occurredAt: "2026-08-01T00:00:00.000Z",
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "safe-detail-page" },
  });
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

function isDetail(input: string | URL | Request): boolean {
  return /\/v1\/cards\/[^/]+\/transactions\/[^?]+$/.test(String(input));
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

async function mount() {
  sessionState = { checking: false, session: session(), error: null };
  await act(async () => {
    renderer = create(createElement(HistoryPage));
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
    createFileRoute: () => (configuration: object) => ({
      ...configuration,
      useSearch: () => ({}),
    }),
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useNavigate: () => () => undefined,
    useRouterState: () => "/history",
  }));
  ({ HistoryPage } = await import("./history"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Mounted History Card transaction detail refresh (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("does not auto-read detail, issues one exact GET per click and retains verified detail", async () => {
      let detailReads = 0;
      const calls = installFetch((input) => {
        if (isCardList(input)) return json({ cards: [card()], nextCursor: null });
        if (isDetail(input)) {
          detailReads += 1;
          if (detailReads === 1)
            return json(transaction("Verified Detail Merchant", "CLEARED", "2600"));
          if (detailReads === 2) {
            return json({ message: "provider-detail-secret-must-not-render" }, 502);
          }
          return json({
            ...transaction("Internal Detail Merchant", "CLEARED", "2700"),
            providerPayload: "provider-payload-must-not-render",
          });
        }
        return json({ transactions: [transaction()], nextCursor: null });
      });
      await mount();
      expect(detailReads).toBe(0);
      expect(pageText()).toContain("List Snapshot Merchant");

      await act(async () => {
        button("List Snapshot Merchant").props.onClick();
        await flush();
      });
      expect(detailReads).toBe(0);
      expect(pageText()).toContain("Selected Card transaction · read only");

      await act(async () => {
        button("Refresh detail").props.onClick();
        await flush();
      });
      expect(detailReads).toBe(1);
      expect(pageText()).toContain("Verified Detail Merchant");
      expect(pageText()).toContain("2600 USD minor units");
      const detailCall = calls.find(({ input }) => isDetail(input));
      expect(String(detailCall?.input)).toBe(
        "/api/v1/cards/card%3Aowned.1/transactions/transaction%3Adetail.1",
      );
      expect(detailCall?.init?.method ?? "GET").toBe("GET");

      await act(async () => {
        button("Refresh detail").props.onClick();
        await flush();
      });
      expect(detailReads).toBe(2);
      expect(pageText()).toContain("Verified Detail Merchant");
      expect(pageText()).toContain("Existing verified detail retained");
      expect(body()).not.toContain("provider-detail-secret-must-not-render");

      await act(async () => {
        button("Refresh detail").props.onClick();
        await flush();
      });
      expect(detailReads).toBe(3);
      expect(pageText()).toContain("Verified Detail Merchant");
      expect(pageText()).not.toContain("Internal Detail Merchant");
      expect(body()).not.toContain("provider-payload-must-not-render");
      await act(flush);
      expect(detailReads).toBe(3);
    });
  },
);
