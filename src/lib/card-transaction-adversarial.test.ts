import { describe, expect, it } from "bun:test";
import {
  CARD_TRANSACTION_MAX_CURSOR_BYTES,
  CARD_TRANSACTION_MAX_JSON_BYTES,
  buildCardTransactionPath,
  cardTransactionReadAllowed,
  normalizeCardTransactionResponse,
  type WalletCardTransaction,
} from "./backend-api";
import {
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "./card-transaction-state";

const cardId = "card:owned.1";
const transactionRecord = (id = "transaction:owned.1") => ({
  id,
  status: "SETTLED",
  amountMinor: "2500",
  authorizedAmountMinor: "2500",
  clearedAmountMinor: "2500",
  settledAmountMinor: "2500",
  reversedAmountMinor: "0",
  refundedAmountMinor: "0",
  currency: "USD",
  traceId: "trace-public-1",
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
const page = (transactions: unknown = [transactionRecord()], nextCursor: unknown = null) =>
  JSON.stringify({ transactions, nextCursor });

describe("Selected-Card transaction adversarial parser matrix", () => {
  it("accepts only bounded raw JSON and never reflects a hostile object", () => {
    expect(CARD_TRANSACTION_MAX_JSON_BYTES).toBe(65_536);
    const traps = { get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
    const proxy = new Proxy(
      { transactions: [transactionRecord()], nextCursor: null },
      {
        get() {
          traps.get += 1;
          throw new Error("get trap must not run");
        },
        getPrototypeOf() {
          traps.getPrototypeOf += 1;
          throw new Error("prototype trap must not run");
        },
        ownKeys() {
          traps.ownKeys += 1;
          throw new Error("ownKeys trap must not run");
        },
        getOwnPropertyDescriptor() {
          traps.getOwnPropertyDescriptor += 1;
          throw new Error("descriptor trap must not run");
        },
      },
    );
    expect(() => normalizeCardTransactionResponse(proxy as unknown as string)).toThrow();
    expect(traps).toEqual({ get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 });
    expect(() => normalizeCardTransactionResponse("not-json")).toThrow();
    expect(() =>
      normalizeCardTransactionResponse(" ".repeat(CARD_TRANSACTION_MAX_JSON_BYTES + 1)),
    ).toThrow();
    expect(() =>
      normalizeCardTransactionResponse(
        `{"transactions":[],"nextCursor":null,"x":"${"€".repeat(22_000)}"}`,
      ),
    ).toThrow();
  });

  it("requires every exact page and official Backend transaction field", () => {
    expect(normalizeCardTransactionResponse(page()).transactions).toHaveLength(1);
    expect(() =>
      normalizeCardTransactionResponse(
        JSON.stringify({
          transactions: [transactionRecord()],
          nextCursor: null,
          provider: "THREDD",
        }),
      ),
    ).toThrow();
    expect(() =>
      normalizeCardTransactionResponse(
        page([{ ...transactionRecord(), journalId: "journal-secret" }]),
      ),
    ).toThrow();
    for (const field of Object.keys(transactionRecord())) {
      const record: Record<string, unknown> = transactionRecord();
      delete record[field];
      expect(() => normalizeCardTransactionResponse(page([record]))).toThrow();
    }
    expect(() => normalizeCardTransactionResponse(JSON.stringify({ transactions: [] }))).toThrow();
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
    expect(CARD_TRANSACTION_MAX_CURSOR_BYTES).toBe(16_384);
    expect(buildCardTransactionPath(cardId, { cursor: "cursor_1-token.signature_1" })).toContain(
      "cursor=cursor_1-token.signature_1",
    );
    expect(
      normalizeCardTransactionResponse(page([], "cursor_1-token.signature_1")).nextCursor,
    ).toBe("cursor_1-token.signature_1");
    for (const cursor of [
      "",
      "no-signature",
      "bad.cursor.extra",
      "bad!:cursor.signature",
      `x.${"y".repeat(CARD_TRANSACTION_MAX_CURSOR_BYTES)}`,
    ]) {
      expect(() => buildCardTransactionPath(cardId, { cursor })).toThrow();
      expect(() => normalizeCardTransactionResponse(page([], cursor))).toThrow();
    }
  });

  it("permits reads only for matching SANDBOX and TEST session/runtime pairs", () => {
    expect(cardTransactionReadAllowed("SANDBOX", "SANDBOX")).toBe(true);
    expect(cardTransactionReadAllowed("TEST", "TEST")).toBe(true);
    expect(cardTransactionReadAllowed("TEST", "SANDBOX")).toBe(false);
    expect(cardTransactionReadAllowed("UAT", "UAT")).toBe(false);
    expect(cardTransactionReadAllowed("PRODUCTION", "PRODUCTION")).toBe(false);
  });
});

const scope = (parts: readonly string[]) => JSON.stringify(parts);
const baseScope: readonly string[] = [
  "actor-a",
  "2099-08-01T08:00:00.000Z",
  "tenant-a",
  "customer-a",
  "SANDBOX",
  cardId,
];

describe("Selected-Card transaction scope, cursor, and generation matrix", () => {
  it("synchronously clears prior rows for every scope dimension including Card", () => {
    const state = {
      ...initialCardTransactionState,
      scopeKey: scope(baseScope),
      activeRequestKey: "request-7",
      transactions: [transaction],
      nextCursor: "cursor-old",
      seenCursors: ["cursor-old"],
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
      activeRequestKey: "request-1",
      transactions: [transaction],
      nextCursor: "cursor-1",
      seenCursors: ["cursor-1"],
    };
    const loadingMore = cardTransactionReducer(loaded, {
      type: "loading-more",
      requestKey: "request-2",
      requestCursor: "cursor-1",
    });
    expect(loadingMore.activeRequestKey).toBe("request-2");
    expect(loadingMore.nextCursor).toBe("cursor-1");

    expect(
      cardTransactionReducer(loadingMore, {
        type: "page",
        requestKey: "request-1",
        requestCursor: "cursor-1",
        page: { transactions: [], nextCursor: "cursor-stale" },
        append: true,
      }),
    ).toBe(loadingMore);
    expect(
      cardTransactionReducer(loadingMore, {
        type: "settled",
        requestKey: "request-1",
      }),
    ).toBe(loadingMore);
    expect(
      cardTransactionReducer(loadingMore, {
        type: "failed",
        requestKey: "request-1",
        message: "stale",
        append: true,
      }),
    ).toBe(loadingMore);
  });

  it("rejects stale success/error after an actor, tenant, customer, environment or Card reset", () => {
    const current = cardTransactionReducer(initialCardTransactionState, {
      type: "reset",
      scopeKey: scope(baseScope),
      requestKey: cardTransactionRequestKey(scope(baseScope), null, 3),
      loading: true,
    });
    expect(
      cardTransactionReducer(current, {
        type: "page",
        requestKey: cardTransactionRequestKey(scope(baseScope), null, 2),
        requestCursor: null,
        page: { transactions: [transaction], nextCursor: "cursor-stale" },
        append: false,
      }),
    ).toBe(current);
    expect(
      cardTransactionReducer(current, {
        type: "failed",
        requestKey: cardTransactionRequestKey(scope(baseScope), null, 2),
        message: "stale",
        append: false,
      }),
    ).toBe(current);
    expect(
      cardTransactionReducer(current, {
        type: "settled",
        requestKey: cardTransactionRequestKey(scope(baseScope), null, 2),
      }),
    ).toBe(current);
  });
});
