import { describe, expect, it } from "bun:test";
import {
  buildCardListPath,
  buildCardTransactionPath,
  buildWalletTransactionPath,
  normalizeCardListResponse,
  normalizeCardTransactionResponse,
  normalizeWalletBalanceResponse,
  normalizeWalletTransactionResponse,
} from "./backend-api";

const publicCard = (id: string) => ({
  id,
  type: "VIRTUAL",
  status: "ACTIVE",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: `Card ${id}`,
  availableBalanceMinor: "12345",
  capabilities: {
    freeze: true,
    unfreeze: false,
    replace: true,
    renew: false,
    updateLimits: true,
  },
  createdAt: "2026-07-31T12:00:00.000Z",
  provider: "THREDD",
  providerPublicToken: "must-not-render",
  tenantId: "must-not-render",
  customerId: "must-not-render",
});

const publicTransaction = (id: string) => ({
  id,
  status: "SETTLED",
  amountMinor: "2500",
  authorizedAmountMinor: "2500",
  clearedAmountMinor: "2500",
  settledAmountMinor: "2500",
  reversedAmountMinor: "0",
  refundedAmountMinor: "0",
  currency: "USD",
  traceId: "must-not-render",
  merchantName: "Coffee",
  merchantCategory: "5812",
  occurredAt: "2026-07-31T12:00:00.000Z",
  tenantId: "must-not-render",
  customerId: "must-not-render",
  cardId: "must-not-render",
  provider: "THREDD",
  providerPayload: { pan: "4111111111111111", token: "secret" },
  journal: { raw: "must-not-render" },
});

describe("Card list Backend adapter", () => {
  it("builds the canonical bounded page request and encodes the opaque cursor", () => {
    expect(buildCardListPath()).toBe("/v1/cards?limit=20");
    expect(buildCardListPath({ limit: 50, cursor: "next_page-token" })).toBe(
      "/v1/cards?limit=50&cursor=next_page-token",
    );
    expect(() => buildCardListPath({ limit: 51 })).toThrow(
      "Card list limit must be between 1 and 50",
    );
    expect(() => buildCardListPath({ cursor: "not!opaque" })).toThrow("Invalid card list cursor");
  });

  it("normalizes the canonical page and keeps only public UI fields", () => {
    const page = normalizeCardListResponse({
      cards: [publicCard("card_1")],
      nextCursor: "next_page-token",
    });

    expect(page).toEqual({
      cards: [
        {
          cardId: "card_1",
          type: "virtual",
          status: "active",
          last4: "4242",
          expiry: "12/30",
          currency: "USD",
          alias: "Card card_1",
          balance: 123.45,
          capabilities: {
            freeze: true,
            unfreeze: false,
            replace: true,
            renew: false,
            updateLimits: true,
          },
        },
      ],
      nextCursor: "next_page-token",
    });
    expect(JSON.stringify(page)).not.toMatch(/THREDD|provider|tenantId|customerId|must-not-render/);
  });

  it("caps a legacy array response to the requested bound during migration", () => {
    const page = normalizeCardListResponse(
      [publicCard("card_1"), publicCard("card_2"), publicCard("card_3")],
      2,
    );

    expect(page.cards.map((card) => card.cardId)).toEqual(["card_1", "card_2"]);
    expect(page.nextCursor).toBeNull();
  });

  it("fails safely for malformed pages, cursors and card records", () => {
    expect(() => normalizeCardListResponse({ cards: "not-an-array", nextCursor: null })).toThrow(
      "Backend returned an invalid card list page",
    );
    expect(() => normalizeCardListResponse({ cards: [], nextCursor: 123 })).toThrow(
      "Backend returned an invalid card list cursor",
    );
    expect(() => normalizeCardListResponse({ cards: [], nextCursor: "" })).toThrow(
      "Backend returned an invalid card list cursor",
    );
    expect(() => normalizeCardListResponse({ cards: [{}], nextCursor: null })).toThrow(
      "Backend returned a card without an id",
    );
  });
});

describe("Card transaction Backend adapter", () => {
  it("builds a selected-Card bounded cursor request", () => {
    expect(buildCardTransactionPath("card/one")).toBe("/v1/cards/card%2Fone/transactions?limit=25");
    expect(buildCardTransactionPath("card_1", { limit: 10, cursor: "txn_cursor-1" })).toBe(
      "/v1/cards/card_1/transactions?limit=10&cursor=txn_cursor-1",
    );
    expect(() => buildCardTransactionPath("card_1", { limit: 26 })).toThrow(
      "Card transaction limit must be between 1 and 25",
    );
    expect(() => buildCardTransactionPath("card_1", { cursor: "bad!cursor" })).toThrow(
      "Invalid card transaction cursor",
    );
    expect(() => buildCardTransactionPath("\n", {})).toThrow("Invalid card transaction card id");
  });

  it("keeps only explicitly allowed public transaction fields", () => {
    const page = normalizeCardTransactionResponse({
      transactions: [publicTransaction("txn_1")],
      nextCursor: "txn_cursor-1",
    });

    expect(page).toEqual({
      transactions: [
        {
          id: "txn_1",
          status: "settled",
          amountMinor: "2500",
          currency: "USD",
          merchant: "Coffee",
          category: "5812",
          timestamp: "2026-07-31T12:00:00.000Z",
        },
      ],
      nextCursor: "txn_cursor-1",
    });
    expect(JSON.stringify(page)).not.toMatch(
      /traceId|tenantId|customerId|cardId|THREDD|provider|payload|journal|pan|token|must-not-render/,
    );
  });

  it("rejects over-limit pages rather than truncating them", () => {
    expect(() =>
      normalizeCardTransactionResponse(
        {
          transactions: [
            publicTransaction("txn_1"),
            publicTransaction("txn_2"),
            publicTransaction("txn_3"),
          ],
          nextCursor: null,
        },
        2,
      ),
    ).toThrow("Backend returned an invalid transaction page");
  });

  it("fails closed for malformed pages, records and cursors", () => {
    expect(() => normalizeCardTransactionResponse({ transactions: [], nextCursor: "" })).toThrow(
      "Backend returned an invalid transaction cursor",
    );
    expect(() =>
      normalizeCardTransactionResponse({ transactions: "bad", nextCursor: null }),
    ).toThrow("Backend returned an invalid transaction page");
    expect(() =>
      normalizeCardTransactionResponse({
        transactions: [{ ...publicTransaction("txn_1"), status: "UNKNOWN" }],
        nextCursor: null,
      }),
    ).toThrow("Backend returned an invalid transaction status");
    for (const status of ["settled", "Settled", "SETtLED"]) {
      expect(() =>
        normalizeCardTransactionResponse({
          transactions: [{ ...publicTransaction("txn_1"), status }],
          nextCursor: null,
        }),
      ).toThrow("Backend returned an invalid transaction status");
    }
    expect(() =>
      normalizeCardTransactionResponse({
        transactions: [{ ...publicTransaction("txn_1"), amountMinor: "25.00" }],
        nextCursor: null,
      }),
    ).toThrow("Backend returned an invalid transaction amount");
    for (const amountMinor of [
      "02500",
      "+2500",
      "-0",
      "9223372036854775808",
      "-9223372036854775809",
      "123456789012345678901234567890",
    ]) {
      expect(() =>
        normalizeCardTransactionResponse({
          transactions: [{ ...publicTransaction("txn_1"), amountMinor }],
          nextCursor: null,
        }),
      ).toThrow("Backend returned an invalid transaction amount");
    }
    expect(() =>
      normalizeCardTransactionResponse({
        transactions: [{ ...publicTransaction("txn_1"), occurredAt: "not-a-date" }],
        nextCursor: null,
      }),
    ).toThrow("Backend returned an invalid transaction timestamp");
  });
});

const publicWalletTransaction = (id: string) => ({
  id,
  type: "TRANSFER",
  status: "COMPLETED",
  assetCode: "USD",
  amount: "25.5",
  direction: "OUTGOING",
  createdAt: "2026-07-31T12:00:00.000Z",
  updatedAt: "2026-07-31T12:00:01.000Z",
  tenantId: "must-not-render",
  customerId: "must-not-render",
  walletAccountId: "must-not-render",
  provider: "THREDD",
  journalIds: ["journal-internal"],
  metadata: { raw: "must-not-render" },
});

describe("Wallet account history Backend adapter", () => {
  it("builds a bounded selected-account request with a filter-bound cursor", () => {
    expect(buildWalletTransactionPath({ assetCode: "USD" })).toBe(
      "/v1/wallet/transactions?assetCode=USD&limit=25",
    );
    expect(
      buildWalletTransactionPath({ assetCode: "USDT", limit: 10, cursor: "filter_cursor-1" }),
    ).toBe("/v1/wallet/transactions?assetCode=USDT&limit=10&cursor=filter_cursor-1");
    expect(() => buildWalletTransactionPath({ assetCode: "usd" })).toThrow(
      "Backend returned an invalid Wallet asset code",
    );
    expect(() => buildWalletTransactionPath({ assetCode: "USD", limit: 26 })).toThrow(
      "Wallet transaction limit must be between 1 and 25",
    );
    expect(() => buildWalletTransactionPath({ assetCode: "USD", cursor: "bad!cursor" })).toThrow(
      "Invalid Wallet transaction cursor",
    );
  });

  it("normalizes public balance accounts without leaking internal fields", () => {
    const accounts = normalizeWalletBalanceResponse({
      items: [
        {
          assetCode: "USD",
          availableBalance: "12.5",
          ledgerBalance: "15",
          pendingBalance: "2.5",
          updatedAt: "2026-07-31T12:00:00.000Z",
          accountId: "must-not-render",
          provider: "THREDD",
          metadata: { raw: true },
        },
      ],
    });

    expect(accounts).toEqual([
      {
        assetCode: "USD",
        availableBalance: "12.5",
        ledgerBalance: "15",
        pendingBalance: "2.5",
        updatedAt: "2026-07-31T12:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(accounts)).not.toMatch(/accountId|provider|THREDD|metadata|raw/);
  });

  it("preserves canonical decimal strings and strict public transaction fields", () => {
    const page = normalizeWalletTransactionResponse(
      { items: [publicWalletTransaction("wallet-txn-1")], nextCursor: "filter_cursor-1" },
      "USD",
    );

    expect(page).toEqual({
      items: [
        {
          id: "wallet-txn-1",
          type: "transfer",
          status: "completed",
          assetCode: "USD",
          amount: "25.5",
          direction: "outgoing",
          createdAt: "2026-07-31T12:00:00.000Z",
          updatedAt: "2026-07-31T12:00:01.000Z",
        },
      ],
      nextCursor: "filter_cursor-1",
    });
    expect(JSON.stringify(page)).not.toMatch(
      /tenantId|customerId|walletAccountId|provider|THREDD|journal|metadata|raw|must-not-render/,
    );
  });

  it("fails closed for over-limit, wrong-account and malformed records", () => {
    expect(() =>
      normalizeWalletTransactionResponse(
        {
          items: [publicWalletTransaction("tx-1"), publicWalletTransaction("tx-2")],
          nextCursor: null,
        },
        "USD",
        1,
      ),
    ).toThrow("Backend returned an invalid Wallet transaction page");
    expect(() =>
      normalizeWalletTransactionResponse(
        {
          items: [{ ...publicWalletTransaction("tx-1"), assetCode: "EUR" }],
          nextCursor: null,
        },
        "USD",
      ),
    ).toThrow("Backend returned a Wallet transaction outside the selected account");

    for (const patch of [
      { type: "transfer" },
      { status: "Completed" },
      { direction: "incoming" },
      { amount: "025.5" },
      { amount: "-25.5" },
      { amount: "1e2" },
      { amount: "1234567890123456789" },
      { amount: "1.1234567890123456789" },
      { createdAt: "not-a-date" },
    ]) {
      expect(() =>
        normalizeWalletTransactionResponse(
          { items: [{ ...publicWalletTransaction("tx-1"), ...patch }], nextCursor: null },
          "USD",
        ),
      ).toThrow();
    }
  });
});
