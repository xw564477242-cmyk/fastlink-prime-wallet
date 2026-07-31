import { describe, expect, it } from "bun:test";
import {
  buildCardTransactionPath,
  normalizeCardTransactionResponse,
  type WalletCardTransaction,
} from "./backend-api";
import {
  cardTransactionReducer,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "./card-transaction-state";

const cardId = "card:owned.1";
const transactionRecord = (id = "transaction:owned.1") => ({
  id,
  status: "SETTLED",
  amountMinor: "2500",
  currency: "USD",
  merchantName: "Coffee",
  merchantCategory: "5812",
  occurredAt: "2026-07-31T12:00:00.000Z",
});
const transaction: WalletCardTransaction = {
  id: "transaction:owned.1",
  status: "settled",
  amountMinor: "2500",
  currency: "USD",
  merchant: "Coffee",
  category: "5812",
  timestamp: "2026-07-31T12:00:00.000Z",
};
const page = (transactions: unknown = [transactionRecord()], nextCursor: unknown = null) => ({
  transactions,
  nextCursor,
});
const nonOrdinaryObjects = [
  null,
  undefined,
  true,
  1,
  "record",
  [],
  new Date(),
  new Map(),
  Object.create(null),
  new (class TransactionResponse {})(),
];

describe("Selected-Card transaction adversarial parser matrix", () => {
  it("rejects non-ordinary page and transaction containers", () => {
    for (const value of nonOrdinaryObjects) {
      expect(() => normalizeCardTransactionResponse(value)).toThrow();
      expect(() => normalizeCardTransactionResponse(page([value]))).toThrow();
    }
  });

  it("requires page and transaction fields to be own data properties", () => {
    for (const field of ["transactions", "nextCursor"]) {
      const record: Record<string, unknown> = page();
      delete record[field];
      expect(() => normalizeCardTransactionResponse(record)).toThrow();
    }
    for (const field of Object.keys(transactionRecord())) {
      const record: Record<string, unknown> = transactionRecord();
      delete record[field];
      expect(() => normalizeCardTransactionResponse(page([record]))).toThrow();
    }
  });

  it("never executes required or unknown page/transaction getters", () => {
    for (const [record, field, normalize] of [
      [page(), "transactions", (value: unknown) => normalizeCardTransactionResponse(value)],
      [
        transactionRecord(),
        "amountMinor",
        (value: unknown) => normalizeCardTransactionResponse(page([value])),
      ],
    ] as const) {
      let executions = 0;
      Object.defineProperty(record, field, {
        enumerable: true,
        get() {
          executions += 1;
          return [];
        },
      });
      expect(() => normalize(record)).toThrow();
      expect(executions).toBe(0);
    }

    for (const [record, normalize] of [
      [page(), (value: unknown) => normalizeCardTransactionResponse(value)],
      [transactionRecord(), (value: unknown) => normalizeCardTransactionResponse(page([value]))],
    ] as const) {
      let executions = 0;
      Object.defineProperty(record, "providerPayload", {
        enumerable: true,
        get() {
          executions += 1;
          throw new Error("provider getter executed");
        },
      });
      normalize(record);
      expect(executions).toBe(0);
    }
  });

  it("rejects array holes, accessor elements, and Array subclasses", () => {
    expect(() => normalizeCardTransactionResponse(page(new Array(1)))).toThrow();

    const accessor = [transactionRecord()];
    let executions = 0;
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        executions += 1;
        return transactionRecord();
      },
    });
    expect(() => normalizeCardTransactionResponse(page(accessor))).toThrow();
    expect(executions).toBe(0);

    class Transactions extends Array<unknown> {}
    expect(() =>
      normalizeCardTransactionResponse(page(new Transactions(transactionRecord()))),
    ).toThrow();
  });

  it("binds the request to one strict opaque Card ID", () => {
    expect(buildCardTransactionPath(cardId)).toBe("/v1/cards/card%3Aowned.1/transactions?limit=25");
    for (const id of ["", "x", "bad/id", "bad id", "bad$id", "x".repeat(129)]) {
      expect(() => buildCardTransactionPath(id)).toThrow();
    }
  });

  it("maps every exact transaction status and rejects variants", () => {
    for (const status of ["AUTHORIZED", "DECLINED", "CLEARED", "SETTLED", "REVERSED", "REFUNDED"]) {
      expect(
        String(
          normalizeCardTransactionResponse(page([{ ...transactionRecord(), status }]))
            .transactions[0]?.status,
        ),
      ).toBe(status.toLowerCase());
    }
    for (const status of ["", "settled", "Settled", "SETTLED_UNKNOWN", 1, null]) {
      expect(() =>
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), status }])),
      ).toThrow();
    }
  });

  it("enforces canonical signed-64 amountMinor boundaries", () => {
    for (const amountMinor of ["-9223372036854775808", "-1", "0", "9223372036854775807"]) {
      expect(
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), amountMinor }]))
          .transactions[0]?.amountMinor,
      ).toBe(amountMinor);
    }
    for (const amountMinor of [
      "-9223372036854775809",
      "9223372036854775808",
      "-0",
      "+1",
      "01",
      "1.0",
      "1e2",
      1,
    ]) {
      expect(() =>
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), amountMinor }])),
      ).toThrow();
    }
  });

  it("strictly validates currency and nullable four-digit MCC", () => {
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), currency }]))
          .transactions[0]?.currency,
      ).toBe(currency);
    }
    for (const currency of ["usd", "US", "USDT", "U1D", 1, null]) {
      expect(() =>
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), currency }])),
      ).toThrow();
    }
    for (const merchantCategory of ["0000", "5812", "9999", null]) {
      expect(
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), merchantCategory }]))
          .transactions[0]?.category,
      ).toBe(merchantCategory ?? "");
    }
    for (const merchantCategory of ["812", "05812", "58A2", "5812 ", "", undefined]) {
      expect(() =>
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), merchantCategory }])),
      ).toThrow();
    }
  });

  it("enforces RFC3339 timestamps", () => {
    for (const occurredAt of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      expect(
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), occurredAt }]))
          .transactions[0]?.timestamp,
      ).toBe(occurredAt);
    }
    for (const occurredAt of [
      undefined,
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31T08:60:00Z",
      "2026-07-31T08:00:60Z",
      "2026-07-31",
    ]) {
      expect(() =>
        normalizeCardTransactionResponse(page([{ ...transactionRecord(), occurredAt }])),
      ).toThrow();
    }
  });

  it("strictly validates opaque cursors", () => {
    expect(buildCardTransactionPath(cardId, { cursor: "cursor_1-token" })).toContain(
      "cursor=cursor_1-token",
    );
    expect(normalizeCardTransactionResponse(page([], "cursor_1-token")).nextCursor).toBe(
      "cursor_1-token",
    );
    for (const cursor of ["", "bad.cursor", "bad:cursor", "bad/cursor", "x".repeat(513)]) {
      expect(() => buildCardTransactionPath(cardId, { cursor })).toThrow();
      expect(() => normalizeCardTransactionResponse(page([], cursor))).toThrow();
    }
  });
});

const scope = (parts: readonly string[]) => JSON.stringify(parts);
const baseScope: readonly string[] = ["actor-a", "tenant-a", "customer-a", "SANDBOX", cardId];

describe("Selected-Card transaction scope, cursor, and generation matrix", () => {
  it("synchronously clears prior rows for every scope dimension including Card", () => {
    const state = {
      ...initialCardTransactionState,
      scopeKey: scope(baseScope),
      requestId: 7,
      transactions: [transaction],
      nextCursor: "cursor-old",
    };
    for (let index = 0; index < baseScope.length; index += 1) {
      const changed = [...baseScope];
      changed[index] = `${changed[index]}-changed`;
      expect(cardTransactionViewForScope(state, scope(changed)).transactions).toEqual([]);
    }
  });

  it("moves to a new generation for the next cursor and rejects stale completions", () => {
    const loaded = {
      ...initialCardTransactionState,
      scopeKey: scope(baseScope),
      requestId: 1,
      transactions: [transaction],
      nextCursor: "cursor-1",
    };
    const loadingMore = cardTransactionReducer(loaded, { type: "loading-more", requestId: 2 });
    expect(loadingMore.requestId).toBe(2);
    expect(loadingMore.nextCursor).toBe("cursor-1");

    expect(
      cardTransactionReducer(loadingMore, {
        type: "page",
        requestId: 1,
        page: { transactions: [], nextCursor: "cursor-stale" },
        append: true,
      }),
    ).toBe(loadingMore);
    expect(
      cardTransactionReducer(loadingMore, {
        type: "failed",
        requestId: 1,
        message: "stale",
        append: true,
      }),
    ).toBe(loadingMore);
  });

  it("rejects stale success/error after an actor, tenant, customer, environment or Card reset", () => {
    const current = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: scope(baseScope),
      requestId: 3,
      loading: true,
    });
    expect(
      cardTransactionReducer(current, {
        type: "page",
        requestId: 2,
        page: { transactions: [transaction], nextCursor: "cursor-stale" },
        append: false,
      }),
    ).toBe(current);
    expect(
      cardTransactionReducer(current, {
        type: "failed",
        requestId: 2,
        message: "stale",
        append: false,
      }),
    ).toBe(current);
  });
});
