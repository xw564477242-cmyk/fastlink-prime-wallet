import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { createElement, type ReactElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { backendRuntime, type BackendSession, type FastLinkEnvironment } from "@/lib/backend-api";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

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
  connect(): Promise<void>;
  refresh(): Promise<void>;
  disconnect(): Promise<void>;
  invalidate: BackendSessionInvalidator;
};

const originalFetch = globalThis.fetch;
const updatedAt = "2026-08-01T00:00:00.000Z";
const providerSecret = "provider-secret-must-not-render";
const journalSecret = "journal-secret-must-not-render";
const traceSecret = "trace-secret-must-not-render";
const internalSecret = "internal-secret-must-not-render";
let renderer: ReactTestRenderer | null = null;
let sessionState: SessionState;
let sessionInvalidations: Array<{ session: BackendSession; reason: string }> = [];
let InternalWalletTransferPage: () => ReactElement;

const configuredTestEnvironment =
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
    throw new Error("Mounted transfer safety test requires SANDBOX or TEST with /api");
  }
  return backendRuntime.environment;
}

function alternateEnvironment(environment: "SANDBOX" | "TEST"): FastLinkEnvironment {
  return environment === "SANDBOX" ? "TEST" : "SANDBOX";
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-mounted-transfer-01",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-mounted-transfer-01",
    customerId: "customer-mounted-transfer-01",
    environment: testEnvironment(),
    ...overrides,
  };
}

function accountWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-mounted-source-01",
    accountCode: "CUSTOMER:SOURCE:USD",
    name: "Mounted Source Wallet",
    assetCode: "USD",
    status: "ACTIVE",
    currentBalance: "100",
    postedBalance: "100",
    pendingBalance: "0",
    availableBalance: "100",
    updatedAt,
    ...overrides,
  };
}

function destinationAccountWire(overrides: Record<string, unknown> = {}) {
  return accountWire({
    id: "account-mounted-destination-02",
    accountCode: "CUSTOMER:DESTINATION:USD",
    name: "Mounted Destination Wallet",
    currentBalance: "50",
    postedBalance: "50",
    availableBalance: "50",
    ...overrides,
  });
}

function operationWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "operation-mounted-transfer-01",
    type: "INTERNAL_TRANSFER",
    status: "PROCESSING",
    assetCode: "USD",
    amount: "25",
    direction: "OUTGOING",
    createdAt: updatedAt,
    completedAt: null,
    updatedAt,
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-safe-mounted" },
  });
}

function isOperationStatus(input: string | URL | Request, init?: RequestInit): boolean {
  return (init?.method ?? "GET") === "GET" && String(input).includes("/v1/wallet/operations/");
}

function isAccountTransactionHistory(input: string | URL | Request, init?: RequestInit): boolean {
  return (
    (init?.method ?? "GET") === "GET" &&
    String(input).includes("/v1/wallet/accounts/") &&
    String(input).includes("/transactions?")
  );
}

function accountTransactionHistoryResponse(
  input: string | URL | Request,
  overrides: Record<string, unknown> = {},
): Response {
  const destination = String(input).includes("account-mounted-destination-02");
  return jsonResponse({
    items: [
      {
        id: destination ? "transaction-mounted-credit-01" : "transaction-mounted-debit-01",
        operationId: "operation-mounted-transfer-01",
        type: "TRANSFER",
        status: "COMPLETED",
        assetCode: "USD",
        amount: "25",
        direction: destination ? "INCOMING" : "OUTGOING",
        createdAt: updatedAt,
        updatedAt,
        ...overrides,
      },
    ],
    nextCursor: null,
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

function responseBody(): string {
  return JSON.stringify(renderer?.toJSON() ?? null);
}

function buttons(): ReactTestInstance[] {
  if (!renderer) throw new Error("Page is not mounted");
  return renderer.root.findAllByType("button");
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
  const match = buttons().find((candidate) => renderedText(candidate).includes(label));
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(currentSession: BackendSession | null) {
  sessionState = {
    checking: false,
    session: currentSession,
    error: null,
    connect: async () => undefined,
    refresh: async () => undefined,
    disconnect: async () => undefined,
    invalidate: (expectedSession, reason) => {
      sessionInvalidations.push({ session: expectedSession, reason });
    },
  };
  await act(async () => {
    renderer = create(createElement(InternalWalletTransferPage));
    await flush();
  });
}

async function updateSession(currentSession: BackendSession | null) {
  if (!renderer) throw new Error("Page is not mounted");
  sessionState = { ...sessionState, session: currentSession };
  await act(async () => {
    renderer?.update(createElement(InternalWalletTransferPage));
    await flush();
  });
}

async function enterTransfer(
  destinationAccountId = "account-mounted-destination-02",
  amount = "25",
) {
  if (!renderer) throw new Error("Page is not mounted");
  const inputs = renderer.root.findAllByType("input");
  expect(inputs).toHaveLength(2);
  await act(async () => {
    inputs[0]?.props.onChange({ target: { value: destinationAccountId } });
    inputs[1]?.props.onChange({ target: { value: amount } });
    await flush();
  });
}

async function resolvePending(pending: Deferred<Response>, value: Response) {
  await act(async () => {
    pending.resolve(value);
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
  mock.module("@/lib/backend-session", () => ({
    useBackendSession: () => sessionState,
  }));
  mock.module("@tanstack/react-router", () => ({
    createFileRoute: () => (configuration: unknown) => configuration,
    Link: ({ children, ...props }: { children?: unknown }) =>
      createElement("a", props, children as ReactElement),
    useNavigate: () => () => undefined,
    useRouterState: () => "/transfer",
  }));
  ({ InternalWalletTransferPage } = await import("./transfer"));
});

afterEach(async () => {
  await unmount();
  globalThis.fetch = originalFetch;
  sessionInvalidations = [];
});

const describeConfiguredEnvironment = configuredTestEnvironment ? describe : describe.skip;

describeConfiguredEnvironment(
  `Mounted Internal Wallet transfer safety (${configuredTestEnvironment ?? "ENVIRONMENT_REQUIRED"})`,
  () => {
    it("requests accounts only for one matching unexpired session", async () => {
      const calls = installFetch(() => jsonResponse([accountWire()]));
      const denied: Array<BackendSession | null> = [
        null,
        session({ expiresAt: "2020-08-01T00:00:00.000Z" }),
        session({ environment: alternateEnvironment(testEnvironment()) }),
      ];
      for (const value of denied) {
        await mount(value);
        expect(calls).toHaveLength(0);
        await unmount();
      }

      await mount(session());
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.input)).toBe("/api/v1/wallet/accounts");
      expect((calls[0]?.init?.method ?? "GET").toUpperCase()).toBe("GET");
      expect(responseBody()).toContain("account-mounted-source-01");
    });

    it("synchronously hides scoped accounts, receipt, busy and error for every identity change and logout", async () => {
      const changes: Array<{ label: string; next: BackendSession | null }> = [
        { label: "same-field Session object", next: session() },
        { label: "actor", next: session({ actorId: "actor-mounted-transfer-02" }) },
        { label: "tenant", next: session({ tenantId: "tenant-mounted-transfer-02" }) },
        { label: "customer", next: session({ customerId: "customer-mounted-transfer-02" }) },
        {
          label: "environment",
          next: session({ environment: alternateEnvironment(testEnvironment()) }),
        },
        { label: "expiresAt", next: session({ expiresAt: "2099-08-01T01:00:00.000Z" }) },
        { label: "logout", next: null },
      ];

      for (const change of changes) {
        const nextAccounts = deferred<Response>();
        const submit = deferred<Response>();
        let accountReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST" || String(input).endsWith("/v1/wallet/transfers")) {
            return submit.promise;
          }
          accountReads += 1;
          return accountReads === 1 ? jsonResponse([accountWire()]) : nextAccounts.promise;
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(responseBody()).toContain("Submitting one request");

        await updateSession(change.next);
        const body = responseBody();
        expect(body, change.label).not.toContain("account-mounted-source-01");
        expect(body, change.label).not.toContain("Submitting one request");
        expect(body, change.label).not.toContain("Wallet operation accepted");
        expect(body, change.label).not.toContain("Wallet transfer was not accepted");
        await rejectPending(submit, new Error(`${internalSecret}-${change.label}`));
        expect(responseBody(), change.label).not.toContain(internalSecret);
        await unmount();

        const nextAccountsAfterError = deferred<Response>();
        let errorAccountReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST" || String(input).endsWith("/v1/wallet/transfers")) {
            return Promise.reject(new Error(`${internalSecret}-${change.label}`));
          }
          errorAccountReads += 1;
          return errorAccountReads === 1
            ? jsonResponse([accountWire()])
            : nextAccountsAfterError.promise;
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(responseBody()).toContain("Transfer result is uncertain");
        await updateSession(change.next);
        expect(responseBody(), change.label).not.toContain("Transfer result is uncertain");
        await unmount();

        const nextAccountsAfterReceipt = deferred<Response>();
        let receiptAccountReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST" || String(input).endsWith("/v1/wallet/transfers")) {
            return jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
          }
          if (isAccountTransactionHistory(input, init)) {
            return accountTransactionHistoryResponse(input);
          }
          receiptAccountReads += 1;
          return receiptAccountReads === 1
            ? jsonResponse([accountWire()])
            : nextAccountsAfterReceipt.promise;
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(responseBody()).toContain("Wallet operation accepted");
        await updateSession(change.next);
        expect(responseBody(), change.label).not.toContain("Wallet operation accepted");
        await unmount();
      }
    });

    it("allows one concurrent POST and creates a fresh UUIDv4 for each later manual submit", async () => {
      const first = deferred<Response>();
      let postCount = 0;
      const calls = installFetch((input, init) => {
        if (init?.method === "POST" || String(input).endsWith("/v1/wallet/transfers")) {
          postCount += 1;
          return postCount === 1 ? first.promise : jsonResponse(operationWire(), 201);
        }
        if (isOperationStatus(input, init)) {
          return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
        }
        if (isAccountTransactionHistory(input, init)) {
          return accountTransactionHistoryResponse(input);
        }
        return jsonResponse([accountWire()]);
      });
      await mount(session());
      await enterTransfer();

      await act(async () => {
        void button("Create transfer operation").props.onClick();
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(postCount).toBe(1);
      await resolvePending(first, jsonResponse(operationWire(), 201));
      expect(responseBody()).toContain("Wallet operation accepted");

      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(postCount).toBe(2);
      const posts = calls.filter(({ init }) => init?.method === "POST");
      const keys = posts.map(({ init }) => new Headers(init?.headers).get("idempotency-key"));
      expect(keys).toHaveLength(2);
      expect(keys[0]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(keys[1]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(keys[1]).not.toBe(keys[0]);
    });

    it("publishes a receipt only after one exact persisted status and clears stale balances", async () => {
      const persistedStatus = deferred<Response>();
      const sourceHistory = deferred<Response>();
      const destinationHistory = deferred<Response>();
      const refreshedAccounts = deferred<Response>();
      let accountReads = 0;
      let postCount = 0;
      let statusReads = 0;
      let historyReads = 0;
      const calls = installFetch((input, init) => {
        if (init?.method === "POST") {
          postCount += 1;
          return jsonResponse(operationWire(), 201);
        }
        if (isOperationStatus(input, init)) {
          statusReads += 1;
          return persistedStatus.promise;
        }
        if (isAccountTransactionHistory(input, init)) {
          historyReads += 1;
          return String(input).includes("account-mounted-destination-02")
            ? destinationHistory.promise
            : sourceHistory.promise;
        }
        accountReads += 1;
        return accountReads === 1
          ? jsonResponse([
              accountWire(),
              accountWire({
                id: "account-mounted-destination-02",
                accountCode: "CUSTOMER:DESTINATION:USD",
                name: "Mounted Destination Wallet",
                currentBalance: "50",
                postedBalance: "50",
                availableBalance: "50",
              }),
            ])
          : refreshedAccounts.promise;
      });
      await mount(session());
      await enterTransfer();

      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });

      expect(postCount).toBe(1);
      expect(statusReads).toBe(1);
      expect(historyReads).toBe(0);
      expect(accountReads).toBe(1);
      expect(responseBody()).not.toContain("Wallet operation accepted");
      expect(responseBody()).not.toContain("Exact available balance");
      expect(responseBody()).not.toContain("100 available");
      const persistedRead = calls.find(({ input, init }) => isOperationStatus(input, init));
      expect(String(persistedRead?.input)).toBe(
        "/api/v1/wallet/operations/operation-mounted-transfer-01",
      );
      expect((persistedRead?.init?.method ?? "GET").toUpperCase()).toBe("GET");
      expect(persistedRead?.init?.body).toBeUndefined();
      expect(new Headers(persistedRead?.init?.headers).has("idempotency-key")).toBe(false);

      await resolvePending(
        persistedStatus,
        jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt })),
      );
      expect(historyReads).toBe(2);
      expect(responseBody()).not.toContain("Wallet operation accepted");
      const historyRequests = calls.filter(({ input, init }) =>
        isAccountTransactionHistory(input, init),
      );
      expect(historyRequests.map(({ input }) => String(input)).sort()).toEqual([
        "/api/v1/wallet/accounts/account-mounted-destination-02/transactions?assetCode=USD&limit=25&type=TRANSFER&status=COMPLETED",
        "/api/v1/wallet/accounts/account-mounted-source-01/transactions?assetCode=USD&limit=25&type=TRANSFER&status=COMPLETED",
      ]);
      expect(historyRequests.every(({ init }) => init?.signal instanceof AbortSignal)).toBe(true);
      expect(historyRequests.every(({ init }) => init?.signal?.aborted === false)).toBe(true);
      expect(historyRequests.every(({ init }) => init?.body === undefined)).toBe(true);
      expect(
        historyRequests.every(({ init }) => !new Headers(init?.headers).has("idempotency-key")),
      ).toBe(true);

      await resolvePending(sourceHistory, accountTransactionHistoryResponse("account-source"));
      expect(responseBody()).not.toContain("Wallet operation accepted");
      await resolvePending(
        destinationHistory,
        accountTransactionHistoryResponse("account-mounted-destination-02"),
      );
      expect(responseBody()).toContain("Wallet operation accepted");
      expect(responseBody()).toContain("transaction-mounted-debit-01");
      expect(responseBody()).toContain("transaction-mounted-credit-01");
      expect(accountReads).toBe(2);
      expect(responseBody()).toContain("Loading scoped Wallet accounts");
      expect(responseBody()).not.toContain("100 available");
      expect(responseBody()).not.toContain("50 available");

      await resolvePending(
        refreshedAccounts,
        jsonResponse([
          accountWire({
            currentBalance: "75",
            postedBalance: "75",
            availableBalance: "75",
          }),
          accountWire({
            id: "account-mounted-destination-02",
            accountCode: "CUSTOMER:DESTINATION:USD",
            name: "Mounted Destination Wallet",
            currentBalance: "75",
            postedBalance: "75",
            availableBalance: "75",
          }),
        ]),
      );
      expect(responseBody()).toContain("Wallet operation accepted");
      expect(responseBody()).toContain("75 available");
      expect(postCount).toBe(1);
      expect(statusReads).toBe(1);
      expect(historyReads).toBe(2);
    });

    it("blocks without re-POST when either exact account history cannot prove the operation", async () => {
      const cases: Array<{
        label: string;
        destinationResponse: Response;
        invalidatesSession?: boolean;
      }> = [
        {
          label: "missing operation binding",
          destinationResponse: accountTransactionHistoryResponse("account-mounted-destination-02", {
            operationId: undefined,
          }),
        },
        {
          label: "different operation binding",
          destinationResponse: accountTransactionHistoryResponse("account-mounted-destination-02", {
            operationId: "operation-mounted-transfer-02",
          }),
        },
        {
          label: "wrong ledger direction",
          destinationResponse: accountTransactionHistoryResponse("account-mounted-destination-02", {
            direction: "OUTGOING",
          }),
        },
        {
          label: "history session expired",
          destinationResponse: jsonResponse({ message: internalSecret }, 401),
          invalidatesSession: true,
        },
      ];

      for (const testCase of cases) {
        sessionInvalidations = [];
        const active = session();
        let postCount = 0;
        let historyReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") {
            postCount += 1;
            return jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
          }
          if (isAccountTransactionHistory(input, init)) {
            historyReads += 1;
            return String(input).includes("account-mounted-destination-02")
              ? testCase.destinationResponse
              : accountTransactionHistoryResponse(input);
          }
          return jsonResponse([accountWire(), destinationAccountWire()]);
        });
        await mount(active);
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });

        expect(postCount, testCase.label).toBe(1);
        expect(historyReads, testCase.label).toBe(2);
        expect(responseBody(), testCase.label).toContain(
          "persisted operation could not be confirmed",
        );
        expect(responseBody(), testCase.label).not.toContain("Wallet operation accepted");
        expect(responseBody(), testCase.label).not.toContain(internalSecret);
        expect(button("Create transfer operation").props.disabled, testCase.label).toBe(true);
        expect(sessionInvalidations, testCase.label).toEqual(
          testCase.invalidatesSession ? [{ session: active, reason: "EXPLICIT_401" }] : [],
        );
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(postCount, testCase.label).toBe(1);
        await unmount();
      }
    });

    it("never requests recipient history outside the current customer account list", async () => {
      let postCount = 0;
      const historyPaths: string[] = [];
      installFetch((input, init) => {
        if (init?.method === "POST") {
          postCount += 1;
          return jsonResponse(operationWire(), 201);
        }
        if (isOperationStatus(input, init)) {
          return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
        }
        if (isAccountTransactionHistory(input, init)) {
          historyPaths.push(String(input));
          return accountTransactionHistoryResponse(input);
        }
        return jsonResponse([accountWire()]);
      });
      await mount(session());
      await enterTransfer();
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });

      expect(postCount).toBe(1);
      expect(historyPaths).toEqual([
        "/api/v1/wallet/accounts/account-mounted-source-01/transactions?assetCode=USD&limit=25&type=TRANSFER&status=COMPLETED",
      ]);
      expect(responseBody()).toContain("Wallet operation accepted");
      expect(responseBody()).toContain("transaction-mounted-debit-01");
      expect(responseBody()).toContain("Recipient history is protected by account ownership");
      expect(responseBody()).not.toContain("transaction-mounted-credit-01");
    });

    it("makes late debit and credit history completions zero-write after Session replacement or unmount", async () => {
      for (const mode of ["replacement", "unmount"] as const) {
        const sourceHistory = deferred<Response>();
        const destinationHistory = deferred<Response>();
        let postCount = 0;
        let historyReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") {
            postCount += 1;
            return jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
          }
          if (isAccountTransactionHistory(input, init)) {
            historyReads += 1;
            return String(input).includes("account-mounted-destination-02")
              ? destinationHistory.promise
              : sourceHistory.promise;
          }
          return jsonResponse([accountWire(), destinationAccountWire()]);
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(postCount, mode).toBe(1);
        expect(historyReads, mode).toBe(2);

        if (mode === "replacement") await updateSession(session());
        else await unmount();
        await resolvePending(sourceHistory, accountTransactionHistoryResponse("account-source"));
        await resolvePending(
          destinationHistory,
          accountTransactionHistoryResponse("account-mounted-destination-02"),
        );
        expect(responseBody(), mode).not.toContain("Wallet operation accepted");
        expect(responseBody(), mode).not.toContain("transaction-mounted-debit-01");
        expect(responseBody(), mode).not.toContain("transaction-mounted-credit-01");
        expect(sessionInvalidations, mode).toEqual([]);
        expect(postCount, mode).toBe(1);
        await unmount();
      }
    });

    it("blocks every new POST when persisted confirmation is missing or inconsistent", async () => {
      const cases: Array<{ label: string; response: Response }> = [
        {
          label: "operation not completed",
          response: jsonResponse(operationWire()),
        },
        {
          label: "different operation",
          response: jsonResponse(operationWire({ id: "operation-mounted-transfer-02" })),
        },
        {
          label: "unknown response field",
          response: jsonResponse(operationWire({ providerReference: providerSecret })),
        },
        { label: "service unavailable", response: jsonResponse({ message: internalSecret }, 503) },
      ];

      for (const testCase of cases) {
        let postCount = 0;
        let statusReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") {
            postCount += 1;
            return jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            statusReads += 1;
            return testCase.response;
          }
          return jsonResponse([accountWire()]);
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });

        expect(postCount, testCase.label).toBe(1);
        expect(statusReads, testCase.label).toBe(1);
        expect(responseBody(), testCase.label).toContain(
          "persisted operation could not be confirmed",
        );
        expect(responseBody(), testCase.label).not.toContain("Wallet operation accepted");
        expect(responseBody(), testCase.label).not.toContain(providerSecret);
        expect(responseBody(), testCase.label).not.toContain(internalSecret);
        expect(button("Create transfer operation").props.disabled, testCase.label).toBe(true);
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(postCount, testCase.label).toBe(1);
        await unmount();
      }
    });

    it("blocks the submitted transfer and invalidates only the exact Session on confirmation 401", async () => {
      let postCount = 0;
      let statusReads = 0;
      const active = session();
      installFetch((input, init) => {
        if (init?.method === "POST") {
          postCount += 1;
          return jsonResponse(operationWire(), 201);
        }
        if (isOperationStatus(input, init)) {
          statusReads += 1;
          return jsonResponse({ message: internalSecret }, 401);
        }
        return jsonResponse([accountWire()]);
      });
      await mount(active);
      await enterTransfer();
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(postCount).toBe(1);
      expect(statusReads).toBe(1);
      expect(sessionInvalidations).toEqual([{ session: active, reason: "EXPLICIT_401" }]);
      expect(responseBody()).toContain("persisted operation could not be confirmed");
      expect(responseBody()).not.toContain(internalSecret);
      expect(button("Create transfer operation").props.disabled).toBe(true);
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(postCount).toBe(1);
    });

    it("makes late persisted confirmations zero-write after Session replacement or unmount", async () => {
      for (const mode of ["replacement", "unmount"] as const) {
        const persistedStatus = deferred<Response>();
        let postCount = 0;
        let statusReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") {
            postCount += 1;
            return jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            statusReads += 1;
            return persistedStatus.promise;
          }
          return jsonResponse([accountWire()]);
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        expect(postCount, mode).toBe(1);
        expect(statusReads, mode).toBe(1);

        if (mode === "replacement") await updateSession(session());
        else await unmount();
        await resolvePending(persistedStatus, jsonResponse(operationWire()));
        expect(responseBody(), mode).not.toContain("Wallet operation accepted");
        expect(sessionInvalidations, mode).toEqual([]);
        expect(postCount, mode).toBe(1);
        expect(statusReads, mode).toBe(1);
        await unmount();
      }
    });

    it("offers only an explicit exact-key retry for 0, 408 and 5xx ambiguity", async () => {
      for (const failure of [0, 408, 503]) {
        const calls = installFetch((input, init) => {
          if (init?.method === "POST") {
            const postCount = calls.filter((call) => call.init?.method === "POST").length;
            return postCount === 1
              ? failure === 0
                ? Promise.reject(new Error("network ambiguity"))
                : jsonResponse({ message: "safe" }, failure)
              : jsonResponse(operationWire(), 201);
          }
          if (isOperationStatus(input, init)) {
            return jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }));
          }
          if (isAccountTransactionHistory(input, init)) {
            return accountTransactionHistoryResponse(input);
          }
          return jsonResponse([accountWire()]);
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        const firstPosts = calls.filter(({ init }) => init?.method === "POST");
        expect(firstPosts, String(failure)).toHaveLength(1);
        expect(responseBody(), String(failure)).toContain("Retry same transfer request");
        expect(responseBody(), String(failure)).toContain("Inputs are locked");
        await act(flush);
        expect(
          calls.filter(({ init }) => init?.method === "POST"),
          String(failure),
        ).toHaveLength(1);

        await act(async () => {
          void button("Retry same transfer request").props.onClick();
          await flush();
        });
        const posts = calls.filter(({ init }) => init?.method === "POST");
        expect(posts, String(failure)).toHaveLength(2);
        expect(new Headers(posts[1]?.init?.headers).get("idempotency-key")).toBe(
          new Headers(posts[0]?.init?.headers).get("idempotency-key"),
        );
        expect(posts[1]?.init?.body).toBe(posts[0]?.init?.body);
        expect(responseBody(), String(failure)).toContain("Wallet operation accepted");
        await unmount();
      }
    });

    it("invalidates only the exact current Session on transfer or status 401", async () => {
      installFetch((input, init) =>
        init?.method === "POST"
          ? jsonResponse({ message: "expired" }, 401)
          : jsonResponse([accountWire()]),
      );
      const active = session();
      await mount(active);
      await enterTransfer();
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(sessionInvalidations).toEqual([{ session: active, reason: "EXPLICIT_401" }]);
      await unmount();

      sessionInvalidations = [];
      let statusReads = 0;
      installFetch((input, init) => {
        if (init?.method === "POST") return jsonResponse(operationWire(), 201);
        if (isOperationStatus(input, init)) {
          statusReads += 1;
          return statusReads === 1
            ? jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }))
            : jsonResponse({ message: "expired" }, 401);
        }
        if (isAccountTransactionHistory(input, init)) {
          return accountTransactionHistoryResponse(input);
        }
        return jsonResponse([accountWire()]);
      });
      const statusSession = session();
      await mount(statusSession);
      await enterTransfer();
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      await act(async () => {
        void button("Refresh operation status").props.onClick();
        await flush();
      });
      expect(sessionInvalidations).toEqual([{ session: statusSession, reason: "EXPLICIT_401" }]);
    });

    it("makes stale or unmounted transfer 401 completions zero-write", async () => {
      for (const mode of ["replacement", "unmount"] as const) {
        const pending = deferred<Response>();
        installFetch((input, init) =>
          init?.method === "POST" ? pending.promise : jsonResponse([accountWire()]),
        );
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        if (mode === "replacement") {
          await updateSession(session({ actorId: "actor-mounted-transfer-02" }));
        } else {
          await unmount();
        }
        await resolvePending(pending, jsonResponse({ message: "late-401-secret" }, 401));
        expect(sessionInvalidations, mode).toEqual([]);
        expect(responseBody(), mode).not.toContain("late-401-secret");
        await unmount();
      }
    });

    it("ignores stale account, submit and status success/error/finally with zero page pollution", async () => {
      const oldAccounts = deferred<Response>();
      const currentAccounts = deferred<Response>();
      let accountReads = 0;
      installFetch((input) => {
        if (String(input).endsWith("/v1/wallet/accounts")) {
          accountReads += 1;
          return accountReads === 1 ? oldAccounts.promise : currentAccounts.promise;
        }
        throw new Error("Unexpected request");
      });
      await mount(session());
      await updateSession(session({ actorId: "actor-mounted-transfer-02" }));
      await resolvePending(
        oldAccounts,
        jsonResponse([accountWire({ id: "account-stale-secret" })]),
      );
      expect(responseBody()).not.toContain("account-stale-secret");
      await resolvePending(currentAccounts, jsonResponse([]));
      await unmount();

      for (const submitResult of ["success", "error"] as const) {
        const pending = deferred<Response>();
        installFetch((input, init) =>
          init?.method === "POST" || String(input).endsWith("/v1/wallet/transfers")
            ? pending.promise
            : jsonResponse([accountWire()]),
        );
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        await updateSession(session({ tenantId: "tenant-mounted-transfer-02" }));
        if (submitResult === "success") {
          await resolvePending(
            pending,
            jsonResponse(operationWire({ id: "operation-stale-secret" }), 201),
          );
        } else {
          await rejectPending(pending, new Error(internalSecret));
        }
        expect(responseBody()).not.toMatch(
          /operation-stale-secret|internal-secret-must-not-render/,
        );
        expect(responseBody()).not.toContain("Wallet operation accepted");
        await unmount();
      }

      for (const statusResult of ["success", "error"] as const) {
        const pendingStatus = deferred<Response>();
        let statusReads = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") return jsonResponse(operationWire(), 201);
          if (isOperationStatus(input, init)) {
            statusReads += 1;
            return statusReads === 1
              ? jsonResponse(operationWire({ status: "COMPLETED", completedAt: updatedAt }))
              : pendingStatus.promise;
          }
          if (isAccountTransactionHistory(input, init)) {
            return accountTransactionHistoryResponse(input);
          }
          return jsonResponse([accountWire()]);
        });
        await mount(session());
        await enterTransfer();
        await act(async () => {
          void button("Create transfer operation").props.onClick();
          await flush();
        });
        await act(async () => {
          void button("Refresh operation status").props.onClick();
          await flush();
        });
        await updateSession(session({ customerId: "customer-mounted-transfer-02" }));
        if (statusResult === "success") {
          await resolvePending(
            pendingStatus,
            jsonResponse(
              operationWire({
                id: "operation-status-stale-secret",
                status: "COMPLETED",
                completedAt: updatedAt,
              }),
            ),
          );
        } else {
          await rejectPending(pendingStatus, new Error(internalSecret));
        }
        expect(responseBody()).not.toMatch(
          /operation-status-stale-secret|internal-secret-must-not-render/,
        );
        expect(responseBody()).not.toContain("Wallet operation accepted");
        await unmount();
      }
    });

    it("never renders Provider, journal, trace, secret or internal response fields and never retries", async () => {
      const secrets = [providerSecret, journalSecret, traceSecret, internalSecret];
      let postCount = 0;
      installFetch((input, init) => {
        if (init?.method === "POST") {
          postCount += 1;
          return jsonResponse(
            {
              ...operationWire(),
              providerReference: providerSecret,
              journalId: journalSecret,
              traceId: traceSecret,
              internalReason: internalSecret,
            },
            201,
          );
        }
        return jsonResponse([accountWire()]);
      });
      await mount(session());
      await enterTransfer();
      await act(async () => {
        void button("Create transfer operation").props.onClick();
        await flush();
      });
      expect(postCount).toBe(1);
      expect(responseBody()).toContain("Wallet transfer was not accepted");
      for (const secret of secrets) expect(responseBody()).not.toContain(secret);
      await act(flush);
      expect(postCount).toBe(1);
    });

    it("fails closed for account, asset, amount and balance inconsistencies before unsafe rendering", async () => {
      const cases: Array<{
        label: string;
        account: Record<string, unknown>;
        destination?: string;
        amount?: string;
        operation?: Record<string, unknown>;
        expectPost: boolean;
      }> = [
        {
          label: "account response field",
          account: accountWire({ providerAccount: providerSecret }),
          expectPost: false,
        },
        {
          label: "balance mismatch",
          account: accountWire({ availableBalance: "99" }),
          expectPost: false,
        },
        {
          label: "same account",
          account: accountWire(),
          destination: "account-mounted-source-01",
          expectPost: false,
        },
        {
          label: "amount above balance",
          account: accountWire(),
          amount: "101",
          expectPost: false,
        },
        {
          label: "response asset mismatch",
          account: accountWire(),
          operation: operationWire({ assetCode: "EUR" }),
          expectPost: true,
        },
        {
          label: "response amount mismatch",
          account: accountWire(),
          operation: operationWire({ amount: "24" }),
          expectPost: true,
        },
      ];

      for (const testCase of cases) {
        let postCount = 0;
        installFetch((input, init) => {
          if (init?.method === "POST") {
            postCount += 1;
            return jsonResponse(testCase.operation ?? operationWire(), 201);
          }
          return jsonResponse([testCase.account]);
        });
        await mount(session());
        if (responseBody().includes("account-mounted-source-01")) {
          await enterTransfer(testCase.destination, testCase.amount);
          await act(async () => {
            const submit = buttons().find((candidate) =>
              renderedText(candidate).includes("Create transfer operation"),
            );
            if (submit) void submit.props.onClick();
            await flush();
          });
        }
        expect(postCount, testCase.label).toBe(testCase.expectPost ? 1 : 0);
        expect(responseBody(), testCase.label).not.toContain("Wallet operation accepted");
        expect(responseBody(), testCase.label).not.toContain(providerSecret);
        await unmount();
      }
    });
  },
);
