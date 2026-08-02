import { describe, expect, it } from "bun:test";
import {
  WALLET_TRANSACTION_MAX_JSON_BYTES,
  buildCardTimelinePath,
  cardTimelineSessionReadAllowed,
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
  normalizeCardTimelineResponse,
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
});

const cardTransactionJson = (value: unknown) => JSON.stringify(value);
const signedCursor = (payload: string) =>
  `${Buffer.from(payload).toString("base64url")}.${Buffer.alloc(32).toString("base64url")}`;

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
    const cursor = signedCursor("txn_cursor-1");
    expect(buildCardTransactionPath("card:one.1")).toBe(
      "/v1/cards/card%3Aone.1/transactions?limit=25",
    );
    expect(buildCardTransactionPath("card_1", { limit: 10, cursor })).toBe(
      `/v1/cards/card_1/transactions?limit=10&cursor=${cursor}`,
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
    const cursor = signedCursor("txn_cursor-1");
    const page = normalizeCardTransactionResponse(
      cardTransactionJson({
        transactions: [publicTransaction("txn_1")],
        nextCursor: cursor,
      }),
    );

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
      nextCursor: cursor,
    });
    expect(JSON.stringify(page)).not.toMatch(
      /traceId|tenantId|customerId|cardId|THREDD|provider|payload|journal|pan|token|must-not-render/,
    );
  });

  it("rejects over-limit pages rather than truncating them", () => {
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({
          transactions: [
            publicTransaction("txn_1"),
            publicTransaction("txn_2"),
            publicTransaction("txn_3"),
          ],
          nextCursor: null,
        }),
        2,
      ),
    ).toThrow("Backend returned an invalid transaction page");
  });

  it("fails closed for malformed pages, records and cursors", () => {
    expect(() =>
      normalizeCardTransactionResponse(cardTransactionJson({ transactions: [], nextCursor: "" })),
    ).toThrow("Backend returned an invalid transaction cursor");
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({ transactions: "bad", nextCursor: null }),
      ),
    ).toThrow("Backend returned an invalid transaction page");
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({
          transactions: [{ ...publicTransaction("txn_1"), status: "UNKNOWN" }],
          nextCursor: null,
        }),
      ),
    ).toThrow("Backend returned an invalid transaction status");
    for (const status of ["settled", "Settled", "SETtLED"]) {
      expect(() =>
        normalizeCardTransactionResponse(
          cardTransactionJson({
            transactions: [{ ...publicTransaction("txn_1"), status }],
            nextCursor: null,
          }),
        ),
      ).toThrow("Backend returned an invalid transaction status");
    }
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({
          transactions: [{ ...publicTransaction("txn_1"), amountMinor: "25.00" }],
          nextCursor: null,
        }),
      ),
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
        normalizeCardTransactionResponse(
          cardTransactionJson({
            transactions: [{ ...publicTransaction("txn_1"), amountMinor }],
            nextCursor: null,
          }),
        ),
      ).toThrow("Backend returned an invalid transaction amount");
    }
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({
          transactions: [{ ...publicTransaction("txn_1"), occurredAt: "not-a-date" }],
          nextCursor: null,
        }),
      ),
    ).toThrow("Backend returned an invalid transaction timestamp");
    expect(() =>
      normalizeCardTransactionResponse(
        cardTransactionJson({
          transactions: [{ ...publicTransaction("txn_1"), provider: "THREDD" }],
          nextCursor: null,
        }),
      ),
    ).toThrow("Backend returned an invalid transaction");
  });
});

describe("Card timeline Backend adapter", () => {
  const timelineCursor = (
    id = "timeline_event_01",
    occurredAt = "2026-08-01T00:00:00.000Z",
    kind: "LIFECYCLE" | "EVENT" = "EVENT",
    macBytes = 32,
    extras: Record<string, unknown> = {},
  ) =>
    `${Buffer.from(JSON.stringify({ v: 1, t: occurredAt, k: kind, i: id, ...extras })).toString("base64url")}.${Buffer.alloc(macBytes).toString("base64url")}`;
  const event = (overrides: Record<string, unknown> = {}) => ({
    id: "timeline_event_01",
    type: "CREATED",
    fromStatus: null,
    toStatus: "PENDING",
    occurredAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });

  it("allows only same-origin matching unexpired SANDBOX/TEST sessions", () => {
    const active = {
      actorId: "actor-timeline",
      tenantId: "tenant-timeline",
      customerId: "customer-timeline",
      environment: "SANDBOX" as const,
      expiresAt: "2026-08-01T01:00:00.000Z",
    };
    const now = Date.parse("2026-08-01T00:00:00.000Z");
    expect(cardTimelineSessionReadAllowed(active, "SANDBOX", "/api", now)).toBeTrue();
    expect(cardTimelineSessionReadAllowed(active, "TEST", "/api", now)).toBeFalse();
    expect(
      cardTimelineSessionReadAllowed(active, "SANDBOX", "https://api.invalid", now),
    ).toBeFalse();
    expect(
      cardTimelineSessionReadAllowed(active, "SANDBOX", "/api", Date.parse(active.expiresAt)),
    ).toBeFalse();
    expect(
      cardTimelineSessionReadAllowed(
        { ...active, environment: "PRODUCTION" },
        "PRODUCTION",
        "/api",
        now,
      ),
    ).toBeFalse();
    expect(
      cardTimelineSessionReadAllowed({ ...active, actorId: "" }, "SANDBOX", "/api", now),
    ).toBeFalse();
  });

  it("builds only the bounded selected-Card GET path with a signed opaque cursor", () => {
    const cursor = timelineCursor();
    expect(buildCardTimelinePath("card:owned.1")).toBe(
      "/v1/cards/card%3Aowned.1/timeline?limit=25",
    );
    expect(buildCardTimelinePath("card_owned", { limit: 10, cursor })).toBe(
      `/v1/cards/card_owned/timeline?limit=10&cursor=${cursor}`,
    );
    expect(() => buildCardTimelinePath("card_owned", { limit: 26 })).toThrow(
      "Card timeline limit must be between 1 and 25",
    );
    expect(() => buildCardTimelinePath("card_owned", { cursor: "not-signed" })).toThrow(
      "Invalid Card timeline cursor",
    );
    expect(() => buildCardTimelinePath("bad/card")).toThrow("Invalid Card timeline Card id");
  });

  it("accepts exactly five public event fields and two page fields", () => {
    const page = normalizeCardTimelineResponse(
      JSON.stringify({ events: [event()], nextCursor: timelineCursor() }),
    );
    expect(Object.keys(page)).toEqual(["events", "nextCursor"]);
    expect(Object.keys(page.events[0])).toEqual([
      "id",
      "type",
      "fromStatus",
      "toStatus",
      "occurredAt",
    ]);
    expect(Object.isFrozen(page)).toBeTrue();
    expect(Object.isFrozen(page.events)).toBeTrue();
    expect(JSON.stringify(page)).not.toMatch(/provider|tenant|customer|secret|trace/i);
  });

  it("fails closed for extra fields, hostile enums, bad time, order, duplicate ids and cursor", () => {
    const normalize = (value: unknown) => normalizeCardTimelineResponse(JSON.stringify(value));
    expect(() =>
      normalize({ events: [event({ providerPayload: "private" })], nextCursor: null }),
    ).toThrow();
    expect(() => normalize({ events: [event()], nextCursor: null, tenantId: "private" })).toThrow();
    expect(() =>
      normalize({ events: [event({ type: "PROVIDER_PRIVATE" })], nextCursor: null }),
    ).toThrow();
    expect(() =>
      normalize({ events: [event({ toStatus: "SUSPENDED" })], nextCursor: null }),
    ).toThrow();
    expect(() =>
      normalize({ events: [event({ occurredAt: "2026-08-01" })], nextCursor: null }),
    ).toThrow();
    expect(() => normalize({ events: [event(), event()], nextCursor: null })).toThrow(/duplicate/i);
    expect(() =>
      normalize({
        events: [
          event(),
          event({ id: "timeline_event_02", occurredAt: "2026-08-01T00:00:01.000Z" }),
        ],
        nextCursor: null,
      }),
    ).toThrow(/order/i);
    expect(() => normalize({ events: [], nextCursor: timelineCursor() })).toThrow();
    expect(() =>
      normalize({
        events: [event()],
        nextCursor: timelineCursor(undefined, undefined, "EVENT", 31),
      }),
    ).toThrow(/cursor/i);
    expect(() =>
      normalize({
        events: [event()],
        nextCursor: timelineCursor(undefined, undefined, "EVENT", 32, { tenantId: "private" }),
      }),
    ).toThrow(/cursor/i);
    expect(() =>
      normalize({ events: [event()], nextCursor: timelineCursor("timeline_event_02") }),
    ).toThrow(/mismatched/i);
    expect(() =>
      normalize({
        events: [event()],
        nextCursor: timelineCursor("timeline_event_01", "2026-07-31T23:59:59.000Z"),
      }),
    ).toThrow(/mismatched/i);
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

  it("bounds raw pages, cursors and duplicate transaction ids", () => {
    const rawPage = JSON.stringify({
      items: [publicWalletTransaction("wallet-txn-1")],
      nextCursor: "filter_cursor-1",
    });
    expect(normalizeWalletTransactionResponse(rawPage, "USD").nextCursor).toBe("filter_cursor-1");
    expect(() =>
      normalizeWalletTransactionResponse(
        JSON.stringify({
          items: [publicWalletTransaction("wallet-txn-1")],
          nextCursor: "x".repeat(513),
        }),
        "USD",
      ),
    ).toThrow("Backend returned an invalid Wallet transaction cursor");
    expect(() =>
      normalizeWalletTransactionResponse(
        JSON.stringify({
          items: [publicWalletTransaction("wallet-txn-1"), publicWalletTransaction("wallet-txn-1")],
          nextCursor: null,
        }),
        "USD",
      ),
    ).toThrow("Backend returned duplicate Wallet transaction ids");
    expect(() =>
      normalizeWalletTransactionResponse(" ".repeat(WALLET_TRANSACTION_MAX_JSON_BYTES + 1), "USD"),
    ).toThrow("Backend returned an oversized Wallet transaction page");
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

const walletOperationCursor = (
  id: string,
  createdAt = "2026-07-31T12:00:00.000Z",
  type: "DEPOSIT" | "INTERNAL_TRANSFER" | "WITHDRAWAL" | "FX_CONVERSION" | null = null,
  status: "PROCESSING" | "PENDING_SETTLEMENT" | "COMPLETED" | "FAILED" | null = null,
) => Buffer.from(JSON.stringify({ version: 2, createdAt, id, type, status })).toString("base64url");
const rawWalletOperationCursor = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("Wallet operation activity Backend adapter", () => {
  it("builds only the real public max-25 cursor request without an asset filter", () => {
    const cursor = walletOperationCursor("operation-1");
    expect(buildWalletOperationPath()).toBe("/v1/wallet/operations?limit=25");
    expect(buildWalletOperationPath({ limit: 10, cursor })).toBe(
      `/v1/wallet/operations?limit=10&cursor=${cursor}`,
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
    const cursor = walletOperationCursor("operation-1");
    const page = normalizeWalletOperationResponse(
      {
        items: [publicWalletOperation("operation-1")],
        nextCursor: cursor,
      },
      { limit: 1 },
    );
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
      nextCursor: cursor,
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
        { limit: 1 },
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

  it("binds type/status filters and exact Backend v2 cursor boundaries", () => {
    const query = { type: "INTERNAL_TRANSFER", status: "PENDING_SETTLEMENT", limit: 1 } as const;
    const cursor = walletOperationCursor(
      "operation-1",
      "2026-07-31T12:00:00.000Z",
      query.type,
      query.status,
    );
    expect(buildWalletOperationPath({ ...query, cursor })).toContain(
      `type=INTERNAL_TRANSFER&status=PENDING_SETTLEMENT&cursor=${cursor}`,
    );
    expect(
      normalizeWalletOperationResponse(
        {
          items: [publicWalletOperation("operation-1")],
          nextCursor: cursor,
        },
        query,
      ).nextCursor,
    ).toBe(cursor);
    expect(() =>
      normalizeWalletOperationResponse(
        {
          items: [{ ...publicWalletOperation("operation-1"), type: "DEPOSIT" }],
          nextCursor: null,
        },
        query,
      ),
    ).toThrow("outside the selected type filter");
    expect(() =>
      buildWalletOperationPath({
        ...query,
        cursor: walletOperationCursor("operation-1", undefined, "DEPOSIT", query.status),
      }),
    ).toThrow("Invalid Wallet operation cursor");
  });

  it("rejects malformed cursor semantics and out-of-order page boundaries", () => {
    const query = { type: "INTERNAL_TRANSFER", status: "PENDING_SETTLEMENT" } as const;
    for (const cursor of [
      rawWalletOperationCursor({
        version: 1,
        createdAt: "2026-07-31T12:00:00.000Z",
        id: "operation-1",
        type: query.type,
        status: query.status,
      }),
      rawWalletOperationCursor({
        version: 2,
        createdAt: "2026-07-31T12:00:00Z",
        id: "operation-1",
        type: query.type,
        status: query.status,
      }),
      rawWalletOperationCursor({
        version: 2,
        createdAt: "2026-07-31T12:00:00.000Z",
        id: "operation-1",
        type: query.type,
        status: query.status,
        extra: true,
      }),
    ])
      expect(() => buildWalletOperationPath({ ...query, cursor })).toThrow(
        "Invalid Wallet operation cursor",
      );

    expect(() =>
      normalizeWalletOperationResponse(
        {
          items: [
            publicWalletOperation("operation-1"),
            { ...publicWalletOperation("operation-2"), createdAt: "2026-07-31T12:01:00.000Z" },
          ],
          nextCursor: null,
        },
        query,
      ),
    ).toThrow("inconsistent Wallet operation pagination");

    const requested = walletOperationCursor(
      "operation-anchor",
      "2026-07-31T12:00:00.000Z",
      query.type,
      query.status,
    );
    expect(() =>
      normalizeWalletOperationResponse(
        {
          items: [
            { ...publicWalletOperation("operation-newer"), createdAt: "2026-07-31T12:01:00.000Z" },
          ],
          nextCursor: null,
        },
        { ...query, cursor: requested },
      ),
    ).toThrow("inconsistent Wallet operation pagination");
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
