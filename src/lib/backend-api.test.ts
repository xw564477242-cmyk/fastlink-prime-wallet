import { describe, expect, it } from "bun:test";
import {
  buildCardListPath,
  buildCardBalancePath,
  buildCardLimitsPath,
  buildCardTransactionPath,
  buildWalletTransactionDetailPath,
  buildWalletTransactionPath,
  buildWalletOperationPath,
  buildWalletOperationDetailPath,
  normalizeCardListResponse,
  normalizeCardBalanceResponse,
  normalizeCardLimitsResponse,
  normalizeCardTransactionResponse,
  normalizeWalletBalanceResponse,
  normalizeWalletTransactionDetail,
  normalizeWalletTransactionResponse,
  normalizeWalletOperationResponse,
  normalizeWalletOperationDetail,
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
          expiryMonth: 12,
          expiryYear: 2030,
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

const publicCardBalance = (cardId: string) => ({
  cardId,
  currency: "USD",
  availableBalanceMinor: "12345",
  currentBalanceMinor: "13000",
  pendingAmountMinor: "655",
  updatedAt: "2026-07-31T08:00:00.000Z",
  tenantId: "must-not-render",
  customerId: "must-not-render",
  environment: "PRODUCTION",
  provider: "THREDD",
  providerPublicToken: "must-not-render",
  providerReference: "must-not-render",
  accountId: "must-not-render",
  walletAccountId: "must-not-render",
  treasuryAccountId: "must-not-render",
  journalIds: ["must-not-render"],
  raw: { secret: "must-not-render" },
});

describe("Selected Card balance Backend adapter", () => {
  it("builds only the published scoped balance path from an exact public Card id", () => {
    expect(buildCardBalancePath("card_owned-1")).toBe("/v1/cards/card_owned-1/balance");
    expect(buildCardBalancePath("card:1")).toBe("/v1/cards/card%3A1/balance");
    expect(buildCardBalancePath("card.1")).toBe("/v1/cards/card.1/balance");
    for (const id of ["", "x", "bad/id", "bad id", "bad$id", "x".repeat(129)]) {
      expect(() => buildCardBalancePath(id)).toThrow("Backend returned an invalid Card id");
    }
  });

  it("accepts the shared opaque colon and dot forms in returned matching Card ids", () => {
    for (const cardId of ["card:1", "card.1"]) {
      expect(normalizeCardBalanceResponse(publicCardBalance(cardId), cardId).cardId).toBe(cardId);
    }
  });

  it("keeps only the six public DTO fields and preserves integer strings", () => {
    const balance = normalizeCardBalanceResponse(publicCardBalance("card_owned-1"), "card_owned-1");
    expect(balance).toEqual({
      cardId: "card_owned-1",
      currency: "USD",
      availableBalanceMinor: "12345",
      currentBalanceMinor: "13000",
      pendingAmountMinor: "655",
      updatedAt: "2026-07-31T08:00:00.000Z",
    });
    expect(JSON.stringify(balance)).not.toMatch(
      /tenantId|customerId|environment|provider|THREDD|accountId|treasury|journal|raw|secret|must-not-render/,
    );
  });

  it("rejects a response for a different selected Card", () => {
    expect(() =>
      normalizeCardBalanceResponse(publicCardBalance("card_other"), "card_owned-1"),
    ).toThrow("Backend returned a balance for a different Card");
  });

  it("strictly validates currency, signed 64-bit minor amounts and RFC3339 time", () => {
    for (const patch of [
      { currency: "usd" },
      { currency: "USDT" },
      { availableBalanceMinor: 12345 },
      { availableBalanceMinor: "012345" },
      { availableBalanceMinor: "+12345" },
      { availableBalanceMinor: "-0" },
      { availableBalanceMinor: "12.00" },
      { currentBalanceMinor: "9223372036854775808" },
      { pendingAmountMinor: "-9223372036854775809" },
      { updatedAt: "2026-07-31" },
      { updatedAt: "2026-02-30T08:00:00Z" },
      { updatedAt: "2026-07-31T24:00:00Z" },
      { updatedAt: "2026-07-31 08:00:00Z" },
    ]) {
      expect(() =>
        normalizeCardBalanceResponse(
          { ...publicCardBalance("card_owned-1"), ...patch },
          "card_owned-1",
        ),
      ).toThrow();
    }
  });

  it("accepts canonical negative balances because the public DTO is signed", () => {
    expect(
      normalizeCardBalanceResponse(
        {
          ...publicCardBalance("card_owned-1"),
          availableBalanceMinor: "-1",
          currentBalanceMinor: "-9223372036854775808",
          pendingAmountMinor: "0",
        },
        "card_owned-1",
      ),
    ).toMatchObject({
      availableBalanceMinor: "-1",
      currentBalanceMinor: "-9223372036854775808",
      pendingAmountMinor: "0",
    });
  });
});

const publicCardLimits = (cardId: string) => ({
  cardId,
  singleTransactionMinor: "10000",
  dailySpendMinor: "50000",
  monthlySpendMinor: "500000",
  dailyAtmMinor: "20000",
  updatedAt: "2026-07-31T08:00:00.000Z",
  tenantId: "must-not-render",
  customerId: "must-not-render",
  environment: "PRODUCTION",
  provider: "THREDD",
  providerOperationRef: "must-not-render",
  accountId: "must-not-render",
  journal: { raw: "must-not-render" },
});

describe("Selected Card limits Backend adapter", () => {
  it("builds only the published read path from an exact public Card id", () => {
    expect(buildCardLimitsPath("card_owned-1")).toBe("/v1/cards/card_owned-1/limits");
    expect(buildCardLimitsPath("card:1")).toBe("/v1/cards/card%3A1/limits");
    expect(buildCardLimitsPath("card.1")).toBe("/v1/cards/card.1/limits");
    for (const id of ["", "x", "bad/id", "bad id", "bad$id", "x".repeat(129)]) {
      expect(() => buildCardLimitsPath(id)).toThrow("Backend returned an invalid Card id");
    }
  });

  it("keeps only the six public DTO fields and preserves canonical integer strings", () => {
    const limits = normalizeCardLimitsResponse(publicCardLimits("card_owned-1"), "card_owned-1");
    expect(limits).toEqual({
      cardId: "card_owned-1",
      singleTransactionMinor: "10000",
      dailySpendMinor: "50000",
      monthlySpendMinor: "500000",
      dailyAtmMinor: "20000",
      updatedAt: "2026-07-31T08:00:00.000Z",
    });
    expect(JSON.stringify(limits)).not.toMatch(
      /tenantId|customerId|environment|provider|THREDD|accountId|journal|raw|must-not-render/,
    );
  });

  it("accepts every nullable field only when it is explicitly null", () => {
    expect(
      normalizeCardLimitsResponse(
        {
          cardId: "card:1",
          singleTransactionMinor: null,
          dailySpendMinor: null,
          monthlySpendMinor: null,
          dailyAtmMinor: null,
          updatedAt: null,
        },
        "card:1",
      ),
    ).toEqual({
      cardId: "card:1",
      singleTransactionMinor: null,
      dailySpendMinor: null,
      monthlySpendMinor: null,
      dailyAtmMinor: null,
      updatedAt: null,
    });
  });

  it("rejects a response for another selected Card", () => {
    expect(() =>
      normalizeCardLimitsResponse(publicCardLimits("card_other"), "card_owned-1"),
    ).toThrow("Backend returned limits for a different Card");
  });

  it("strictly validates nonnegative signed-64-bit canonical limits and RFC3339 time", () => {
    for (const patch of [
      { singleTransactionMinor: undefined },
      { singleTransactionMinor: 10000 },
      { singleTransactionMinor: "-1" },
      { singleTransactionMinor: "-0" },
      { singleTransactionMinor: "+1" },
      { dailySpendMinor: "01" },
      { monthlySpendMinor: "1.0" },
      { dailyAtmMinor: "1e3" },
      { dailyAtmMinor: "9223372036854775808" },
      { updatedAt: undefined },
      { updatedAt: "2026-02-30T08:00:00Z" },
      { updatedAt: "2026-07-31" },
    ]) {
      expect(() =>
        normalizeCardLimitsResponse(
          { ...publicCardLimits("card_owned-1"), ...patch },
          "card_owned-1",
        ),
      ).toThrow();
    }
    expect(
      normalizeCardLimitsResponse(
        {
          ...publicCardLimits("card_owned-1"),
          singleTransactionMinor: "0",
          dailySpendMinor: "9223372036854775807",
        },
        "card_owned-1",
      ),
    ).toMatchObject({ singleTransactionMinor: "0", dailySpendMinor: "9223372036854775807" });
  });
});

describe("Card transaction Backend adapter", () => {
  it("builds a selected-Card bounded cursor request", () => {
    expect(buildCardTransactionPath("card:one.1")).toBe(
      "/v1/cards/card%3Aone.1/transactions?limit=25",
    );
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
    expect(() => buildCardTransactionPath("card/one", {})).toThrow(
      "Invalid card transaction card id",
    );
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

  it("normalizes the exact public balance summary from bounded raw JSON text", () => {
    const accounts = normalizeWalletBalanceResponse(
      JSON.stringify({
        items: [
          {
            assetCode: "USD",
            availableBalance: "12.5",
            ledgerBalance: "15",
            pendingBalance: "2.5",
            updatedAt: "2026-07-31T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(accounts).toEqual([
      {
        assetCode: "USD",
        availableBalance: "12.5",
        ledgerBalance: "15",
        pendingBalance: "2.5",
        updatedAt: "2026-07-31T12:00:00.000Z",
      },
    ]);
    expect(Object.keys(accounts[0]).sort()).toEqual([
      "assetCode",
      "availableBalance",
      "ledgerBalance",
      "pendingBalance",
      "updatedAt",
    ]);
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

describe("Wallet transaction detail Backend adapter", () => {
  it("builds only a validated immutable transaction detail path", () => {
    expect(buildWalletTransactionDetailPath("wallet-txn:1")).toBe(
      "/v1/wallet/transactions/wallet-txn%3A1",
    );
    for (const id of ["", "x", "bad/id", "bad id", "x".repeat(129)]) {
      expect(() => buildWalletTransactionDetailPath(id)).toThrow("Invalid Wallet transaction id");
    }
  });

  it("accepts the exact public detail when id, account and amount match history", () => {
    const detail = normalizeWalletTransactionDetail(publicWalletTransaction("wallet-txn-1"), {
      transactionId: "wallet-txn-1",
      assetCode: "USD",
      amount: "25.5",
    });

    expect(detail).toEqual({
      id: "wallet-txn-1",
      type: "transfer",
      status: "completed",
      assetCode: "USD",
      amount: "25.5",
      direction: "outgoing",
      createdAt: "2026-07-31T12:00:00.000Z",
      updatedAt: "2026-07-31T12:00:01.000Z",
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /tenantId|customerId|walletAccountId|provider|THREDD|journal|metadata|raw|must-not-render/,
    );
  });

  it("fails closed when detail differs from the selected history item", () => {
    expect(() =>
      normalizeWalletTransactionDetail(publicWalletTransaction("different-txn"), {
        transactionId: "wallet-txn-1",
        assetCode: "USD",
        amount: "25.5",
      }),
    ).toThrow("Backend returned a different Wallet transaction id");
    expect(() =>
      normalizeWalletTransactionDetail(
        { ...publicWalletTransaction("wallet-txn-1"), assetCode: "EUR" },
        { transactionId: "wallet-txn-1", assetCode: "USD", amount: "25.5" },
      ),
    ).toThrow("Backend returned a Wallet transaction outside the selected account");
    expect(() =>
      normalizeWalletTransactionDetail(
        { ...publicWalletTransaction("wallet-txn-1"), amount: "25.50" },
        { transactionId: "wallet-txn-1", assetCode: "USD", amount: "25.5" },
      ),
    ).toThrow("Backend returned an inconsistent Wallet transaction amount");
  });

  it("reuses exact enums and canonical Decimal(36,18) validation", () => {
    for (const patch of [
      { type: "transfer" },
      { status: "Completed" },
      { direction: "outgoing" },
      { amount: "025.5" },
      { amount: "-25.5" },
      { amount: "1e2" },
      { amount: "1234567890123456789" },
      { amount: "1.1234567890123456789" },
    ]) {
      expect(() =>
        normalizeWalletTransactionDetail(
          { ...publicWalletTransaction("wallet-txn-1"), ...patch },
          { transactionId: "wallet-txn-1", assetCode: "USD", amount: "25.5" },
        ),
      ).toThrow();
    }
  });
});

const publicWalletOperation = (id: string) => ({
  id,
  type: "INTERNAL_TRANSFER",
  status: "PENDING_SETTLEMENT",
  assetCode: "USD",
  amount: "25.5",
  direction: "BETWEEN_OWN_ACCOUNTS",
  createdAt: "2026-07-31T12:00:00.000Z",
  completedAt: null,
  updatedAt: "2026-07-31T12:00:01+00:00",
  tenantId: "must-not-render",
  customerId: "must-not-render",
  accountId: "must-not-render",
  provider: "THREDD",
  journalIds: ["must-not-render"],
  failureReason: "must-not-render",
  raw: { secret: "must-not-render" },
});

describe("Wallet operation activity Backend adapter", () => {
  it("builds only the real public max-25 cursor request without an asset filter", () => {
    expect(buildWalletOperationPath()).toBe("/v1/wallet/operations?limit=25");
    expect(buildWalletOperationPath({ limit: 10, cursor: "activity_cursor-1" })).toBe(
      "/v1/wallet/operations?limit=10&cursor=activity_cursor-1",
    );
    expect(() => buildWalletOperationPath({ limit: 26 })).toThrow(
      "Wallet operation limit must be between 1 and 25",
    );
    expect(() => buildWalletOperationPath({ cursor: "bad!cursor" })).toThrow(
      "Invalid Wallet operation cursor",
    );
    expect(buildWalletOperationPath()).not.toContain("asset");
  });

  it("keeps exactly the public fields and canonical strings", () => {
    const page = normalizeWalletOperationResponse({
      items: [publicWalletOperation("operation-1")],
      nextCursor: "activity_cursor-1",
    });
    expect(page).toEqual({
      items: [
        {
          id: "operation-1",
          type: "internal_transfer",
          status: "pending_settlement",
          assetCode: "USD",
          amount: "25.5",
          direction: "between_own_accounts",
          createdAt: "2026-07-31T12:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-07-31T12:00:01+00:00",
        },
      ],
      nextCursor: "activity_cursor-1",
    });
    expect(JSON.stringify(page)).not.toMatch(
      /tenantId|customerId|accountId|provider|THREDD|journal|failureReason|raw|secret|must-not-render/,
    );
  });

  it("accepts only explicit null or RFC3339 completedAt", () => {
    const completed = normalizeWalletOperationResponse({
      items: [
        {
          ...publicWalletOperation("operation-1"),
          completedAt: "2026-07-31T12:01:00Z",
        },
      ],
      nextCursor: null,
    });
    expect(completed.items[0]?.completedAt).toBe("2026-07-31T12:01:00Z");
    const { completedAt: _completedAt, ...missingCompletedAt } =
      publicWalletOperation("operation-2");
    expect(() =>
      normalizeWalletOperationResponse({ items: [missingCompletedAt], nextCursor: null }),
    ).toThrow("Backend returned an invalid Wallet operation completedAt");
  });

  it("rejects malformed enums, Decimal(36,18), timestamps and asset codes", () => {
    for (const patch of [
      { type: "internal_transfer" },
      { type: "TRANSFER" },
      { status: "Pending_Settlement" },
      { direction: "between_own_accounts" },
      { assetCode: "usd" },
      { amount: "025.5" },
      { amount: "-25.5" },
      { amount: "1e2" },
      { amount: "1234567890123456789" },
      { amount: "1.1234567890123456789" },
      { createdAt: "2026-07-31" },
      { createdAt: "2026-02-30T12:00:00Z" },
      { createdAt: "2026-07-31T24:00:00Z" },
      { updatedAt: "2026-07-31 12:00:00Z" },
      { completedAt: "2026-07-31T12:00:00" },
    ]) {
      expect(() =>
        normalizeWalletOperationResponse({
          items: [{ ...publicWalletOperation("operation-1"), ...patch }],
          nextCursor: null,
        }),
      ).toThrow();
    }
  });

  it("rejects over-limit pages, invalid cursors and duplicate ids", () => {
    expect(() =>
      normalizeWalletOperationResponse(
        {
          items: [publicWalletOperation("operation-1"), publicWalletOperation("operation-2")],
          nextCursor: null,
        },
        1,
      ),
    ).toThrow("Backend returned an invalid Wallet operation page");
    expect(() => normalizeWalletOperationResponse({ items: [], nextCursor: "bad!cursor" })).toThrow(
      "Backend returned an invalid Wallet operation cursor",
    );
    expect(() =>
      normalizeWalletOperationResponse({
        items: [publicWalletOperation("operation-1"), publicWalletOperation("operation-1")],
        nextCursor: null,
      }),
    ).toThrow("Backend returned duplicate Wallet operation ids");
  });
});

describe("Wallet operation detail Backend adapter", () => {
  it("builds the published detail route from one validated opaque operation id", () => {
    expect(buildWalletOperationDetailPath("operation:owned-1")).toBe(
      "/v1/wallet/operations/operation%3Aowned-1",
    );
    for (const id of ["", "x", "bad/id", "bad id", "bad$id", "x".repeat(129)]) {
      expect(() => buildWalletOperationDetailPath(id)).toThrow("Invalid Wallet operation id");
    }
  });

  it("accepts only the public contract when the returned id matches the selection", () => {
    const detail = normalizeWalletOperationDetail(publicWalletOperation("operation-1"), {
      operationId: "operation-1",
    });
    expect(detail).toEqual({
      id: "operation-1",
      type: "internal_transfer",
      status: "pending_settlement",
      assetCode: "USD",
      amount: "25.5",
      direction: "between_own_accounts",
      createdAt: "2026-07-31T12:00:00.000Z",
      completedAt: null,
      updatedAt: "2026-07-31T12:00:01+00:00",
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /tenantId|customerId|accountId|provider|THREDD|journal|failureReason|raw|secret|must-not-render/,
    );
  });

  it("rejects a substituted id and reuses strict enum, decimal and RFC3339 validation", () => {
    expect(() =>
      normalizeWalletOperationDetail(publicWalletOperation("operation-other"), {
        operationId: "operation-selected",
      }),
    ).toThrow("Backend returned a different Wallet operation id");
    for (const patch of [
      { type: "internal_transfer" },
      { status: "Pending_Settlement" },
      { direction: "between_own_accounts" },
      { amount: "025.5" },
      { amount: "-25.5" },
      { amount: "1e2" },
      { amount: "1234567890123456789" },
      { amount: "1.1234567890123456789" },
      { createdAt: "2026-02-30T12:00:00Z" },
      { completedAt: undefined },
    ]) {
      expect(() =>
        normalizeWalletOperationDetail(
          { ...publicWalletOperation("operation-selected"), ...patch },
          { operationId: "operation-selected" },
        ),
      ).toThrow();
    }
  });
});
