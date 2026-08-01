import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  backendRuntime,
  type BackendSession,
  type CardTransactionFilter,
  type WalletCardTransaction,
} from "@/lib/backend-api";
import { useCardTransactionDetail } from "./use-card-transaction-detail";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HookResult = ReturnType<typeof useCardTransactionDetail>;
type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
let renderer: ReactTestRenderer | null = null;
let latest: HookResult | null = null;
const configuredEnvironment =
  !backendRuntime.error &&
  backendRuntime.apiUrl === "/api" &&
  (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST")
    ? backendRuntime.environment
    : null;

function environment(): "SANDBOX" | "TEST" {
  if (backendRuntime.environment !== "SANDBOX" && backendRuntime.environment !== "TEST") {
    throw new Error("Card detail mounted test requires SANDBOX or TEST");
  }
  return backendRuntime.environment;
}

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-card-detail-hook",
    expiresAt: "2099-08-01T00:00:00.000Z",
    tenantId: "tenant-card-detail-hook",
    customerId: "customer-card-detail-hook",
    environment: environment(),
    ...overrides,
  };
}

function transaction(
  id = "transaction:detail.1",
  patch: Partial<WalletCardTransaction> = {},
): WalletCardTransaction {
  return {
    id,
    status: "settled",
    amountMinor: "2500",
    currency: "USD",
    merchant: "Coffee",
    category: "5812",
    timestamp: "2026-08-01T00:00:00.000Z",
    ...patch,
  };
}

function wireTransaction(item: WalletCardTransaction) {
  return {
    id: item.id,
    status: item.status.toUpperCase(),
    amountMinor: item.amountMinor,
    authorizedAmountMinor: item.amountMinor,
    clearedAmountMinor: item.amountMinor,
    settledAmountMinor: item.amountMinor,
    reversedAmountMinor: "0",
    refundedAmountMinor: "0",
    currency: item.currency,
    traceId: "trace-card-detail-hook",
    merchantName: item.merchant,
    merchantCategory: item.category || null,
    occurredAt: item.timestamp,
  };
}

function response(item: WalletCardTransaction): Response {
  return new Response(JSON.stringify(wireTransaction(item)), {
    status: 200,
    headers: { "content-type": "application/json", "x-trace-id": "safe-detail-hook" },
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

type HarnessProps = {
  currentSession: BackendSession | null;
  cardId: string | null;
  filter: CardTransactionFilter;
  selected: WalletCardTransaction | null;
  historyScopeKey: string | null;
};

function Harness(props: HarnessProps) {
  latest = useCardTransactionDetail(
    props.currentSession,
    props.cardId,
    props.filter,
    props.selected,
    props.historyScopeKey,
  );
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(props: Partial<HarnessProps> = {}) {
  const complete: HarnessProps = {
    currentSession: session(),
    cardId: "card:owned.1",
    filter: "ALL",
    selected: transaction(),
    historyScopeKey: "card-history-scope-v1",
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
  Date.now = originalDateNow;
});

const describeEnvironment = configuredEnvironment ? describe : describe.skip;

describeEnvironment(
  `Mounted Card transaction manual detail refresh (${configuredEnvironment ?? "ENV_REQUIRED"})`,
  () => {
    it("uses zero automatic reads and exactly one GET per click while aborting repeats", async () => {
      const stale = deferred<Response>();
      const current = deferred<Response>();
      let reads = 0;
      const calls = installFetch(() => {
        reads += 1;
        if (reads === 1) return response(transaction());
        if (reads === 2) return stale.promise;
        if (reads === 3) return current.promise;
        return new Response(JSON.stringify({ message: "provider-secret" }), { status: 502 });
      });
      await mount();
      expect(calls).toHaveLength(0);
      expect(latest?.canRefresh).toBe(true);

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(latest?.detail).toEqual(transaction());

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(latest?.detail).toEqual(transaction());
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls[1]?.init?.signal?.aborted).toBe(true);
      expect(latest?.detail).toEqual(transaction());
      for (const call of calls) {
        expect(String(call.input)).toBe(
          "/api/v1/cards/card%3Aowned.1/transactions/transaction%3Adetail.1",
        );
        expect(call.init?.method ?? "GET").toBe("GET");
      }

      const replacement = transaction("transaction:detail.1", {
        status: "cleared",
        amountMinor: "2600",
      });
      await act(async () => {
        current.resolve(response(replacement));
        await current.promise;
        await flush();
      });
      expect(latest?.detail).toEqual(replacement);

      await act(async () => {
        stale.reject(new Error("stale-provider-secret"));
        await stale.promise.catch(() => undefined);
        await flush();
      });
      expect(latest?.detail).toEqual(replacement);
      expect(latest?.error).toBeNull();

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls).toHaveLength(4);
      expect(latest?.detail).toEqual(replacement);
      expect(latest?.error).toBe("Card transaction detail is unavailable");
      expect(JSON.stringify(latest)).not.toContain("provider-secret");
      await act(flush);
      expect(calls).toHaveLength(4);
    });

    it("actively aborts on selection, filter, Card, session, logout and unmount", async () => {
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
        const call = calls.at(-1);
        expect(call?.init?.signal?.aborted).toBe(false);
        await update(next);
        expect(call?.init?.signal?.aborted).toBe(true);
        expect(latest?.detail).toBeNull();
        props = next;
      };

      await changeAndExpectAbort({
        ...props,
        selected: transaction("transaction:detail.2"),
      });
      await changeAndExpectAbort({ ...props, filter: "SETTLED" });
      await changeAndExpectAbort({ ...props, cardId: "card:owned.2" });
      await changeAndExpectAbort({
        ...props,
        currentSession: session({ customerId: "customer-card-detail-other" }),
      });
      await changeAndExpectAbort({ ...props, currentSession: null });

      await update({ ...props, currentSession: session() });
      await act(async () => {
        latest?.refresh();
        await flush();
      });
      const unmountedCall = calls.at(-1);
      await unmount();
      expect(unmountedCall?.init?.signal?.aborted).toBe(true);

      for (let index = 0; index < pendingReads.length; index += 1) {
        pendingReads[index]?.resolve(
          response(transaction(`transaction:late.${index}`, { currency: "EUR" })),
        );
      }
      await flush();
    });

    it("performs zero success and finally writes when the session naturally expires", async () => {
      const expiry = Date.parse("2026-08-01T00:00:01.000Z");
      let now = expiry - 1;
      Date.now = () => now;
      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      await mount({
        currentSession: session({ expiresAt: "2026-08-01T00:00:01.000Z" }),
      });

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls).toHaveLength(1);
      expect(latest?.loading).toBe(true);
      expect(latest?.detail).toBeNull();

      now = expiry;
      await act(async () => {
        pending.resolve(response(transaction("transaction:detail.1", { amountMinor: "2600" })));
        await pending.promise;
        await flush();
      });
      expect(latest?.detail).toBeNull();
      expect(latest?.error).toBeNull();
      expect(latest?.loading).toBe(true);
    });

    it("performs zero error and finally writes when the session naturally expires", async () => {
      const expiry = Date.parse("2026-08-01T00:00:01.000Z");
      let now = expiry - 1;
      Date.now = () => now;
      const pending = deferred<Response>();
      const calls = installFetch(() => pending.promise);
      await mount({
        currentSession: session({ expiresAt: "2026-08-01T00:00:01.000Z" }),
      });

      await act(async () => {
        latest?.refresh();
        await flush();
      });
      expect(calls).toHaveLength(1);
      expect(latest?.loading).toBe(true);

      now = expiry;
      await act(async () => {
        pending.reject(new Error("provider-secret-after-expiry"));
        await pending.promise.catch(() => undefined);
        await flush();
      });
      expect(latest?.detail).toBeNull();
      expect(latest?.error).toBeNull();
      expect(latest?.loading).toBe(true);
      expect(JSON.stringify(latest)).not.toContain("provider-secret-after-expiry");
    });
  },
);
