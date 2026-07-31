import { describe, expect, it } from "bun:test";
import {
  buildCardTransactionPath,
  normalizeCardTransactionResponse,
  type WalletCardTransaction,
} from "./backend-api";
import {
  CARD_TRANSACTION_PAGINATION_ERROR,
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "./card-transaction-state";

const baseScope = JSON.stringify(["actor-a", "tenant-a", "customer-a", "SANDBOX", "card:owned.1"]);

const transaction = (id: string): WalletCardTransaction => ({
  id,
  status: "settled",
  amountMinor: "9223372036854775807",
  currency: "USD",
  merchant: "Coffee",
  category: "5812",
  timestamp: "2026-07-31T12:00:00.123456789+08:00",
});

function firstPage() {
  const requestKey = cardTransactionRequestKey(baseScope, null, 1);
  const reset = cardTransactionReducer(initialCardTransactionState, {
    type: "reset",
    scopeKey: baseScope,
    requestKey,
    loading: true,
  });
  return cardTransactionReducer(reset, {
    type: "page",
    requestKey,
    requestCursor: null,
    page: { transactions: [transaction("transaction:owned.2")], nextCursor: "cursor-1" },
    append: false,
  });
}

function loadingPage(cursor = "cursor-1", generation = 2) {
  const state = firstPage();
  const requestKey = cardTransactionRequestKey(baseScope, cursor, generation);
  return {
    requestKey,
    state: cardTransactionReducer(state, {
      type: "loading-more",
      requestKey,
      requestCursor: cursor,
    }),
  };
}

describe("Selected-Card transaction pagination adversarial consistency", () => {
  it("fails closed when one page repeats a transaction ID", () => {
    const requestKey = cardTransactionRequestKey(baseScope, null, 1);
    const reset = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: baseScope,
      requestKey,
      loading: true,
    });
    const failed = cardTransactionReducer(reset, {
      type: "page",
      requestKey,
      requestCursor: null,
      page: {
        transactions: [transaction("transaction:owned.1"), transaction("transaction:owned.1")],
        nextCursor: "cursor-1",
      },
      append: false,
    });

    expect(failed.transactions).toEqual([]);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("fails closed without overwrite or duplicate on an append conflict", () => {
    const { state, requestKey } = loadingPage();
    const trustedRows = state.transactions;
    const failed = cardTransactionReducer(state, {
      type: "page",
      requestKey,
      requestCursor: "cursor-1",
      page: { transactions: [transaction("transaction:owned.2")], nextCursor: "cursor-2" },
      append: true,
    });

    expect(failed.transactions).toBe(trustedRows);
    expect(failed.transactions.map(({ id }) => id)).toEqual(["transaction:owned.2"]);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("fails closed when nextCursor repeats the request cursor", () => {
    const { state, requestKey } = loadingPage();
    const failed = cardTransactionReducer(state, {
      type: "page",
      requestKey,
      requestCursor: "cursor-1",
      page: { transactions: [transaction("transaction:owned.1")], nextCursor: "cursor-1" },
      append: true,
    });

    expect(failed.transactions).toEqual(state.transactions);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("fails closed when nextCursor rolls back to any cursor seen in this generation", () => {
    const secondRequest = loadingPage();
    const secondPage = cardTransactionReducer(secondRequest.state, {
      type: "page",
      requestKey: secondRequest.requestKey,
      requestCursor: "cursor-1",
      page: { transactions: [transaction("transaction:owned.1")], nextCursor: "cursor-2" },
      append: true,
    });
    const requestKey = cardTransactionRequestKey(baseScope, "cursor-2", 3);
    const loading = cardTransactionReducer(secondPage, {
      type: "loading-more",
      requestKey,
      requestCursor: "cursor-2",
    });
    const failed = cardTransactionReducer(loading, {
      type: "page",
      requestKey,
      requestCursor: "cursor-2",
      page: { transactions: [transaction("transaction:owned.0")], nextCursor: "cursor-1" },
      append: true,
    });

    expect(failed.transactions).toEqual(secondPage.transactions);
    expect(failed.seenCursors).toEqual(["cursor-1", "cursor-2"]);
    expect(failed.nextCursor).toBeNull();
    expect(failed.error).toBe(CARD_TRANSACTION_PAGINATION_ERROR);
  });

  it("accepts forward-only unique pages and terminal null cursor", () => {
    const secondRequest = loadingPage();
    const secondPage = cardTransactionReducer(secondRequest.state, {
      type: "page",
      requestKey: secondRequest.requestKey,
      requestCursor: "cursor-1",
      page: { transactions: [transaction("transaction:owned.1")], nextCursor: "cursor-2" },
      append: true,
    });
    const requestKey = cardTransactionRequestKey(baseScope, "cursor-2", 3);
    const loading = cardTransactionReducer(secondPage, {
      type: "loading-more",
      requestKey,
      requestCursor: "cursor-2",
    });
    const terminal = cardTransactionReducer(loading, {
      type: "page",
      requestKey,
      requestCursor: "cursor-2",
      page: { transactions: [transaction("transaction:owned.0")], nextCursor: null },
      append: true,
    });

    expect(terminal.transactions.map(({ id }) => id)).toEqual([
      "transaction:owned.2",
      "transaction:owned.1",
      "transaction:owned.0",
    ]);
    expect(terminal.nextCursor).toBeNull();
    expect(terminal.error).toBeNull();
  });

  it("allows zero writes from stale pages and errors after every scope dimension changes", () => {
    const dimensions = ["actor-b", "tenant-b", "customer-b", "UAT", "card:owned.9"];
    const oldRequestKey = cardTransactionRequestKey(baseScope, "cursor-1", 2);

    for (let index = 0; index < dimensions.length; index += 1) {
      const parts = ["actor-a", "tenant-a", "customer-a", "SANDBOX", "card:owned.1"];
      parts[index] = dimensions[index]!;
      const scopeKey = JSON.stringify(parts);
      const requestKey = cardTransactionRequestKey(scopeKey, null, index + 10);
      const current = cardTransactionReducer(firstPage(), {
        type: "reset",
        scopeKey,
        requestKey,
        loading: true,
      });
      const stalePage = cardTransactionReducer(current, {
        type: "page",
        requestKey: oldRequestKey,
        requestCursor: "cursor-1",
        page: { transactions: [transaction("transaction:foreign")], nextCursor: "cursor-foreign" },
        append: true,
      });
      const staleError = cardTransactionReducer(current, {
        type: "failed",
        requestKey: oldRequestKey,
        message: "foreign error",
        append: true,
      });

      expect(stalePage).toBe(current);
      expect(staleError).toBe(current);
      expect(cardTransactionViewForScope(stalePage, scopeKey).transactions).toEqual([]);
    }
  });

  it("keeps opaque ID, signed-64, RFC3339 and no-getter parser guarantees", () => {
    const record = {
      id: "transaction:owned.9223372036854775807",
      status: "SETTLED",
      amountMinor: "-9223372036854775808",
      currency: "USD",
      merchantName: "Coffee",
      merchantCategory: "5812",
      occurredAt: "2026-07-31T12:00:00.123456789+08:00",
    };
    let getterExecutions = 0;
    Object.defineProperty(record, "providerPayload", {
      enumerable: true,
      get() {
        getterExecutions += 1;
        return "secret";
      },
    });

    const parsed = normalizeCardTransactionResponse({ transactions: [record], nextCursor: null });
    expect(parsed.transactions[0]?.id).toBe("transaction:owned.9223372036854775807");
    expect(parsed.transactions[0]?.amountMinor).toBe("-9223372036854775808");
    expect(parsed.transactions[0]?.timestamp).toBe("2026-07-31T12:00:00.123456789+08:00");
    expect(getterExecutions).toBe(0);
    expect(buildCardTransactionPath("card:owned.9223372036854775807")).toContain(
      "card%3Aowned.9223372036854775807",
    );
  });
});
