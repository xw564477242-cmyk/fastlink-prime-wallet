import { describe, expect, it } from "bun:test";
import {
  normalizeWalletAssetCatalogResponse,
  normalizeWalletOwnedAccountTransactionResponse,
} from "./backend-api";

const query = {
  assetCode: "USDT",
  type: "TRANSFER" as const,
  status: "COMPLETED" as const,
  limit: 2,
};

function catalog(items: unknown[] = [{ assetCode: "USDT", assetClass: "DIGITAL" }]) {
  return JSON.stringify({ environment: "SANDBOX", items });
}

function transaction(id: string, createdAt: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    operationId: null,
    type: "TRANSFER",
    status: "COMPLETED",
    assetCode: "USDT",
    amount: "1.25",
    direction: "INCOMING",
    createdAt,
    updatedAt: createdAt,
    ...patch,
  };
}

describe("Wallet digital asset catalog contract", () => {
  it("accepts only the exact environment-bound, sorted public catalog", () => {
    expect(
      normalizeWalletAssetCatalogResponse(
        catalog([
          { assetCode: "USD", assetClass: "FIAT" },
          { assetCode: "USDT", assetClass: "DIGITAL" },
        ]),
        "SANDBOX",
      ),
    ).toEqual({
      environment: "SANDBOX",
      items: [
        { assetCode: "USD", assetClass: "FIAT" },
        { assetCode: "USDT", assetClass: "DIGITAL" },
      ],
    });
  });

  for (const [name, raw] of [
    ["wrong environment", JSON.stringify({ environment: "TEST", items: [] })],
    ["empty", catalog([])],
    ["unknown root field", JSON.stringify({ environment: "SANDBOX", items: [], secret: 1 })],
    ["unknown item field", catalog([{ assetCode: "USDT", assetClass: "DIGITAL", icon: "x" }])],
    ["wrong class", catalog([{ assetCode: "USDT", assetClass: "CRYPTO" }])],
    [
      "unsorted",
      catalog([
        { assetCode: "USDT", assetClass: "DIGITAL" },
        { assetCode: "USD", assetClass: "FIAT" },
      ]),
    ],
    [
      "duplicate",
      catalog([
        { assetCode: "USDT", assetClass: "DIGITAL" },
        { assetCode: "USDT", assetClass: "DIGITAL" },
      ]),
    ],
    [
      "duplicate root JSON key",
      '{"environment":"SANDBOX","environment":"SANDBOX","items":[{"assetCode":"USDT","assetClass":"DIGITAL"}]}',
    ],
    [
      "duplicate item JSON key",
      '{"environment":"SANDBOX","items":[{"assetCode":"USDT","assetCode":"USDT","assetClass":"DIGITAL"}]}',
    ],
  ] as const) {
    it(`rejects ${name}`, () => {
      expect(() => normalizeWalletAssetCatalogResponse(raw, "SANDBOX")).toThrow();
    });
  }

  it("rejects byte-oversized catalog input", () => {
    const oversized = `${catalog()}${" ".repeat(4097)}`;
    expect(() => normalizeWalletAssetCatalogResponse(oversized, "SANDBOX")).toThrow();
  });
});

describe("Owned Wallet account history contract", () => {
  it("accepts a complete card binding, keeps legacy rows compatible, and rejects partial identity", () => {
    const cardBound = normalizeWalletOwnedAccountTransactionResponse(
      JSON.stringify({
        items: [
          transaction("tx-card", "2026-08-03T12:00:00.000Z", {
            cardId: "card_01",
            cardType: "VIRTUAL",
          }),
        ],
        nextCursor: null,
      }),
      "account-usdt",
      { ...query, limit: 1 },
    );
    expect(cardBound.items[0]).toEqual(
      expect.objectContaining({ cardId: "card_01", cardType: "virtual" }),
    );
    expect(() =>
      normalizeWalletOwnedAccountTransactionResponse(
        JSON.stringify({
          items: [
            transaction("tx-partial", "2026-08-03T12:00:00.000Z", {
              cardId: "card_01",
            }),
          ],
          nextCursor: null,
        }),
        "account-usdt",
        { ...query, limit: 1 },
      ),
    ).toThrow();
  });

  it("accepts exact account-bound, filtered, newest-first items and a canonical cursor", () => {
    expect(
      normalizeWalletOwnedAccountTransactionResponse(
        JSON.stringify({
          items: [
            transaction("tx-b", "2026-08-03T12:00:00.000Z", { operationId: "op-1" }),
            transaction("tx-a", "2026-08-03T12:00:00.000Z"),
          ],
          nextCursor: "Y3Vyc29y.c2ln",
        }),
        "account-usdt",
        query,
      ),
    ).toEqual({
      items: [
        {
          id: "tx-b",
          operationId: "op-1",
          type: "transfer",
          status: "completed",
          assetCode: "USDT",
          amount: "1.25",
          direction: "incoming",
          createdAt: "2026-08-03T12:00:00.000Z",
          updatedAt: "2026-08-03T12:00:00.000Z",
        },
        {
          id: "tx-a",
          operationId: null,
          type: "transfer",
          status: "completed",
          assetCode: "USDT",
          amount: "1.25",
          direction: "incoming",
          createdAt: "2026-08-03T12:00:00.000Z",
          updatedAt: "2026-08-03T12:00:00.000Z",
        },
      ],
      nextCursor: "Y3Vyc29y.c2ln",
    });
  });

  for (const [name, value] of [
    [
      "unknown item field",
      {
        items: [transaction("tx-a", "2026-08-03T12:00:00.000Z", { provider: "secret" })],
        nextCursor: null,
      },
    ],
    [
      "other asset",
      {
        items: [transaction("tx-a", "2026-08-03T12:00:00.000Z", { assetCode: "USD" })],
        nextCursor: null,
      },
    ],
    [
      "other filter",
      {
        items: [transaction("tx-a", "2026-08-03T12:00:00.000Z", { status: "PENDING" })],
        nextCursor: null,
      },
    ],
    [
      "duplicate id",
      {
        items: [
          transaction("tx-a", "2026-08-03T12:00:01.000Z"),
          transaction("tx-a", "2026-08-03T12:00:00.000Z"),
        ],
        nextCursor: null,
      },
    ],
    [
      "wrong order",
      {
        items: [
          transaction("tx-a", "2026-08-03T12:00:00.000Z"),
          transaction("tx-b", "2026-08-03T12:00:01.000Z"),
        ],
        nextCursor: null,
      },
    ],
    [
      "short cursor page",
      { items: [transaction("tx-a", "2026-08-03T12:00:00.000Z")], nextCursor: "Y3Vyc29y.c2ln" },
    ],
    [
      "invalid cursor",
      {
        items: [
          transaction("tx-b", "2026-08-03T12:00:01.000Z"),
          transaction("tx-a", "2026-08-03T12:00:00.000Z"),
        ],
        nextCursor: "not-signed",
      },
    ],
    [
      "non-canonical timestamp",
      {
        items: [transaction("tx-a", "2026-08-03T12:00:00Z")],
        nextCursor: null,
      },
    ],
    [
      "backward updatedAt",
      {
        items: [
          transaction("tx-a", "2026-08-03T12:00:01.000Z", {
            updatedAt: "2026-08-03T12:00:00.000Z",
          }),
        ],
        nextCursor: null,
      },
    ],
  ] as const) {
    it(`rejects ${name}`, () => {
      expect(() =>
        normalizeWalletOwnedAccountTransactionResponse(
          JSON.stringify(value),
          "account-usdt",
          query,
        ),
      ).toThrow();
    });
  }

  it("rejects duplicate keys before JSON.parse can collapse them", () => {
    const raw = `{"items":[{"id":"tx-a","id":"tx-b","operationId":null,"type":"TRANSFER","status":"COMPLETED","assetCode":"USDT","amount":"1.25","direction":"INCOMING","createdAt":"2026-08-03T12:00:00.000Z","updatedAt":"2026-08-03T12:00:00.000Z"}],"nextCursor":null}`;
    expect(() =>
      normalizeWalletOwnedAccountTransactionResponse(raw, "account-usdt", query),
    ).toThrow();
  });

  it("rejects replay of the requested cursor", () => {
    expect(() =>
      normalizeWalletOwnedAccountTransactionResponse(
        JSON.stringify({
          items: [
            transaction("tx-b", "2026-08-03T12:00:01.000Z"),
            transaction("tx-a", "2026-08-03T12:00:00.000Z"),
          ],
          nextCursor: "Y3Vyc29y.c2ln",
        }),
        "account-usdt",
        { ...query, cursor: "Y3Vyc29y.c2ln" },
      ),
    ).toThrow();
  });
});
