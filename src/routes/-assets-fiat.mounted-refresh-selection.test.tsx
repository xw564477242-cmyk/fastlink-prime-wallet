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
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let WalletAccountsPage: () => ReactElement;

const configuredEnvironment =
  backendRuntime.error === null &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Mounted Wallet refresh selection test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-wallet-selection-01",
    tenantId: "tenant-wallet-selection-01",
    customerId: "customer-wallet-selection-01",
    environment: environment(),
    expiresAt: "2099-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function balanceResponse(): Response {
  return json({
    items: [
      {
        assetCode: "USD",
        availableBalance: "10",
        ledgerBalance: "12.5",
        pendingBalance: "2.5",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  });
}

function transaction(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    type: "TRANSFER",
    status: "COMPLETED",
    assetCode: "USD",
    amount: "25.5",
    direction: "OUTGOING",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:01.000Z",
    ...patch,
  };
}

function transactionPage(items: unknown[], nextCursor: string | null = null): Response {
  return json({ items, nextCursor });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "safe-selection-trace" },
  });
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
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

function isBalance(input: string | URL | Request): boolean {
  return String(input).endsWith("/v1/wallet/balances");
}

function isHistory(input: string | URL | Request): boolean {
  return String(input).includes("/v1/wallet/transactions?");
}

function isDetail(input: string | URL | Request): boolean {
  return /\/v1\/wallet\/transactions\/[^?]+$/.test(String(input));
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
  if (!renderer) throw new Error("Wallet page is not mounted");
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
    renderer = create(createElement(WalletAccountsPage));
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
    createFileRoute: () => (configuration: object) => configuration,
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useNavigate: () => () => undefined,
    useRouterState: () => "/assets/fiat",
  }));
  mock.module("@/hooks/use-wallet-operations", () => ({
    useWalletOperations: () => ({
      items: [],
      nextCursor: null,
      loading: false,
      loadingMore: false,
      refreshing: false,
      error: null,
      refreshError: null,
      filters: { type: "ALL", status: "ALL" },
      changeFilters: () => undefined,
      loadMore: async () => undefined,
      refresh: () => undefined,
      canRefresh: true,
    }),
  }));
  mock.module("@/hooks/use-wallet-operation-detail", () => ({
    useWalletOperationDetail: () => ({ detail: null, loading: false, error: null }),
  }));
  ({ WalletAccountsPage } = await import("./assets.fiat"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
});

const describeConfigured = configuredEnvironment ? describe : describe.skip;

describeConfigured(
  `Mounted Wallet refresh selection safety (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("clears a removed selection so the same ID cannot revive from a later page", async () => {
      let historyReads = 0;
      let detailReads = 0;
      installFetch((input) => {
        if (isBalance(input)) return balanceResponse();
        if (isHistory(input)) {
          historyReads += 1;
          if (historyReads === 1) return transactionPage([transaction("tx-old")]);
          if (historyReads === 2) {
            return transactionPage(
              [transaction("tx-new", { amount: "10" })],
              "cmVmcmVzaGVk.c2lnbmF0dXJl",
            );
          }
          return transactionPage([transaction("tx-old")]);
        }
        if (isDetail(input)) {
          detailReads += 1;
          return json(transaction("tx-old"));
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      });

      await mount();
      await act(async () => {
        button("25.5 USD").props.onClick();
        await flush();
      });
      expect(pageText()).toContain("Refresh selected transaction");
      expect(detailReads).toBe(1);

      await act(async () => {
        button("Refresh transaction history").props.onClick();
        await flush();
      });
      expect(pageText()).not.toContain("Refresh selected transaction");
      expect(pageText()).toContain("10 USD");

      await act(async () => {
        await button("Load more transactions").props.onClick();
        await flush();
      });
      expect(pageText()).toContain("25.5 USD");
      expect(pageText()).not.toContain("Refresh selected transaction");
      expect(detailReads).toBe(1);
    });

    it("rebinds a surviving ID to the refreshed public record and rejects old detail completion", async () => {
      const oldDetail = deferred<Response>();
      const currentDetail = deferred<Response>();
      let historyReads = 0;
      let detailReads = 0;
      const calls = installFetch((input) => {
        if (isBalance(input)) return balanceResponse();
        if (isHistory(input)) {
          historyReads += 1;
          return historyReads === 1
            ? transactionPage([transaction("tx-shared")])
            : transactionPage([
                transaction("tx-shared", {
                  amount: "30",
                  status: "PENDING",
                  updatedAt: "2026-08-01T01:00:00.000Z",
                }),
              ]);
        }
        if (isDetail(input)) {
          detailReads += 1;
          return detailReads === 1 ? oldDetail.promise : currentDetail.promise;
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      });

      await mount();
      await act(async () => {
        button("25.5 USD").props.onClick();
        await flush();
      });
      await act(async () => {
        button("Refresh transaction history").props.onClick();
        await flush();
      });
      const detailCalls = calls.filter(({ input }) => isDetail(input));
      expect(detailCalls).toHaveLength(2);
      expect(detailCalls[0]?.init?.signal?.aborted).toBe(true);

      await act(async () => {
        oldDetail.resolve(json(transaction("tx-shared")));
        await flush();
      });
      expect(pageText()).not.toContain("25.5 USD");
      await act(async () => {
        currentDetail.resolve(json(transaction("tx-shared", { amount: "30", status: "REVERSED" })));
        await flush();
      });
      expect(pageText()).toContain("30 USD");
      expect(pageText()).toContain("reversed");
      expect(pageText()).toContain("Refresh selected transaction");
    });

    it("retains the valid selection, detail, list and cursor when refresh fails", async () => {
      let historyReads = 0;
      let detailReads = 0;
      installFetch((input) => {
        if (isBalance(input)) return balanceResponse();
        if (isHistory(input)) {
          historyReads += 1;
          return historyReads === 1
            ? transactionPage([transaction("tx-kept")], "a2VwdA.c2lnbmF0dXJl")
            : json({ message: "provider-secret" }, 503);
        }
        if (isDetail(input)) {
          detailReads += 1;
          return json(transaction("tx-kept"));
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      });

      await mount();
      await act(async () => {
        button("25.5 USD").props.onClick();
        await flush();
      });
      await act(async () => {
        button("Refresh transaction history").props.onClick();
        await flush();
      });

      expect(pageText()).toContain("Wallet transaction history refresh failed");
      expect(pageText()).not.toContain("provider-secret");
      expect(pageText()).toContain("25.5 USD");
      expect(pageText()).toContain("Refresh selected transaction");
      expect(pageText()).toContain("Load more transactions");
      expect(detailReads).toBe(1);
    });

    it("aborts an in-flight refresh on filter change and unmount with zero stale page writes", async () => {
      const staleRefresh = deferred<Response>();
      let historyReads = 0;
      const calls = installFetch((input) => {
        if (isBalance(input)) return balanceResponse();
        if (isHistory(input)) {
          historyReads += 1;
          if (historyReads === 1) return transactionPage([transaction("tx-current")]);
          if (historyReads === 2) return staleRefresh.promise;
          return transactionPage([transaction("tx-filtered", { status: "PENDING", amount: "40" })]);
        }
        if (isDetail(input)) return json(transaction("tx-current"));
        throw new Error(`Unexpected request: ${String(input)}`);
      });

      await mount();
      await act(async () => {
        button("Refresh transaction history").props.onClick();
        await flush();
      });
      const refreshCall = calls.filter(({ input }) => isHistory(input))[1];
      const statusSelect = renderer?.root
        .findAllByType("select")
        .find((candidate) => candidate.props["aria-label"] === "Wallet transaction status");
      if (!statusSelect) throw new Error("Missing status filter");
      await act(async () => {
        statusSelect.props.onChange({ target: { value: "PENDING" } });
        await flush();
      });
      expect(refreshCall?.init?.signal?.aborted).toBe(true);
      expect(pageText()).toContain("40 USD");

      await act(async () => {
        staleRefresh.resolve(transactionPage([transaction("tx-stale", { amount: "999" })]));
        await flush();
      });
      expect(pageText()).not.toContain("999 USD");

      const unmountRefresh = deferred<Response>();
      let unmountSignal: AbortSignal | null | undefined;
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        if (isHistory(input)) {
          unmountSignal = init?.signal;
          return unmountRefresh.promise;
        }
        return balanceResponse();
      }) as typeof globalThis.fetch;
      await act(async () => {
        button("Refresh transaction history").props.onClick();
        await flush();
      });
      await unmount();
      expect(unmountSignal?.aborted).toBe(true);
      unmountRefresh.resolve(transactionPage([transaction("tx-unmounted")]));
    });
  },
);
