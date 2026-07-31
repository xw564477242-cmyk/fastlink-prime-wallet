import { describe, expect, it } from "bun:test";
import { buildCardListPath, normalizeCardListResponse } from "./backend-api";

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
