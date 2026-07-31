import { describe, expect, it } from "bun:test";
import {
  normalizeCardBalanceResponse,
  normalizeCardLimitsResponse,
  type WalletCardBalance,
  type WalletCardLimits,
} from "./backend-api";
import {
  cardBalanceReducer,
  cardBalanceRequestKey,
  cardBalanceViewForScope,
  initialCardBalanceState,
} from "./card-balance-state";
import {
  cardLimitsReducer,
  cardLimitsRequestKey,
  cardLimitsViewForScope,
  initialCardLimitsState,
} from "./card-limits-state";

const cardId = "card:owned.1";
const balanceRecord = () => ({
  cardId,
  currency: "USD",
  availableBalanceMinor: "12345",
  currentBalanceMinor: "13000",
  pendingAmountMinor: "655",
  updatedAt: "2026-07-31T08:00:00.000Z",
});
const limitsRecord = () => ({
  cardId,
  singleTransactionMinor: "10000",
  dailySpendMinor: "50000",
  monthlySpendMinor: "500000",
  dailyAtmMinor: null,
  updatedAt: "2026-07-31T08:00:00.000Z",
});

const balance: WalletCardBalance = balanceRecord();
const limits: WalletCardLimits = limitsRecord();

const ordinaryObjectRejects = [
  null,
  undefined,
  true,
  1,
  "record",
  [],
  new Date(),
  new Map(),
  Object.create(null),
  new (class CardResponse {})(),
];

describe("Card public read adversarial parser matrix", () => {
  it("rejects non-ordinary balance and limits response containers", () => {
    for (const value of ordinaryObjectRejects) {
      expect(() => normalizeCardBalanceResponse(value, cardId)).toThrow();
      expect(() => normalizeCardLimitsResponse(value, cardId)).toThrow();
    }
  });

  it("rejects every missing required balance and limits data field", () => {
    for (const field of Object.keys(balanceRecord())) {
      const record: Record<string, unknown> = balanceRecord();
      delete record[field];
      expect(() => normalizeCardBalanceResponse(record, cardId)).toThrow();
    }
    for (const field of Object.keys(limitsRecord())) {
      const record: Record<string, unknown> = limitsRecord();
      delete record[field];
      expect(() => normalizeCardLimitsResponse(record, cardId)).toThrow();
    }
  });

  it("never executes a getter used in place of a required data field", () => {
    for (const [record, field, normalize] of [
      [balanceRecord(), "availableBalanceMinor", normalizeCardBalanceResponse],
      [limitsRecord(), "dailySpendMinor", normalizeCardLimitsResponse],
    ] as const) {
      let executions = 0;
      Object.defineProperty(record, field, {
        enumerable: true,
        get() {
          executions += 1;
          return "999";
        },
      });
      expect(() => normalize(record, cardId)).toThrow();
      expect(executions).toBe(0);
    }
  });

  it("ignores unknown accessor fields without executing them", () => {
    for (const [record, normalize] of [
      [balanceRecord(), normalizeCardBalanceResponse],
      [limitsRecord(), normalizeCardLimitsResponse],
    ] as const) {
      let executions = 0;
      Object.defineProperty(record, "providerPayload", {
        enumerable: true,
        get() {
          executions += 1;
          throw new Error("provider secret getter executed");
        },
      });
      expect(normalize(record, cardId).cardId).toBe(cardId);
      expect(executions).toBe(0);
    }
  });

  it("rejects cross-Card substitution for both public read contracts", () => {
    expect(() =>
      normalizeCardBalanceResponse({ ...balanceRecord(), cardId: "card:other.1" }, cardId),
    ).toThrow("different Card");
    expect(() =>
      normalizeCardLimitsResponse({ ...limitsRecord(), cardId: "card:other.1" }, cardId),
    ).toThrow("different Card");
  });

  it("enforces signed-64 balance and nonnegative signed-64 limits boundaries", () => {
    expect(
      normalizeCardBalanceResponse(
        {
          ...balanceRecord(),
          availableBalanceMinor: "-9223372036854775808",
          currentBalanceMinor: "9223372036854775807",
          pendingAmountMinor: "0",
        },
        cardId,
      ),
    ).toMatchObject({
      availableBalanceMinor: "-9223372036854775808",
      currentBalanceMinor: "9223372036854775807",
    });
    for (const invalid of ["-9223372036854775809", "9223372036854775808"]) {
      expect(() =>
        normalizeCardBalanceResponse(
          { ...balanceRecord(), availableBalanceMinor: invalid },
          cardId,
        ),
      ).toThrow();
    }

    expect(
      normalizeCardLimitsResponse(
        { ...limitsRecord(), singleTransactionMinor: "0", dailySpendMinor: "9223372036854775807" },
        cardId,
      ),
    ).toMatchObject({ singleTransactionMinor: "0", dailySpendMinor: "9223372036854775807" });
    for (const invalid of ["-1", "9223372036854775808"]) {
      expect(() =>
        normalizeCardLimitsResponse({ ...limitsRecord(), dailySpendMinor: invalid }, cardId),
      ).toThrow();
    }
  });

  it("accepts valid RFC3339 forms and rejects impossible or incomplete timestamps", () => {
    for (const updatedAt of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      expect(
        normalizeCardBalanceResponse({ ...balanceRecord(), updatedAt }, cardId).updatedAt,
      ).toBe(updatedAt);
      expect(normalizeCardLimitsResponse({ ...limitsRecord(), updatedAt }, cardId).updatedAt).toBe(
        updatedAt,
      );
    }
    for (const updatedAt of [
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31T08:60:00Z",
      "2026-07-31T08:00:60Z",
      "2026-07-31",
    ]) {
      expect(() =>
        normalizeCardBalanceResponse({ ...balanceRecord(), updatedAt }, cardId),
      ).toThrow();
      expect(() => normalizeCardLimitsResponse({ ...limitsRecord(), updatedAt }, cardId)).toThrow();
    }
  });
});

const scope = (parts: readonly string[]) => JSON.stringify(parts);
const baseScope: readonly string[] = ["actor-a", "tenant-a", "customer-a", "SANDBOX", cardId];

describe("Card public read adversarial scope and generation matrix", () => {
  it("synchronously clears each prior result when one scope dimension changes", () => {
    const balanceState = {
      ...initialCardBalanceState,
      scopeKey: scope(baseScope),
      activeRequestKey: "balance-old",
      balance,
    };
    const limitsState = {
      ...initialCardLimitsState,
      scopeKey: scope(baseScope),
      activeRequestKey: "limits-old",
      limits,
    };
    for (let index = 0; index < baseScope.length; index += 1) {
      const changed = [...baseScope];
      changed[index] = `${changed[index]}-changed`;
      expect(cardBalanceViewForScope(balanceState, scope(changed)).balance).toBeNull();
      expect(cardLimitsViewForScope(limitsState, scope(changed)).limits).toBeNull();
    }
  });

  it("changes both request keys for every scope dimension and generation", () => {
    const balanceKey = cardBalanceRequestKey(scope(baseScope), 1);
    const limitsKey = cardLimitsRequestKey(scope(baseScope), 1);
    for (let index = 0; index < baseScope.length; index += 1) {
      const changed = [...baseScope];
      changed[index] = `${changed[index]}-changed`;
      expect(cardBalanceRequestKey(scope(changed), 1)).not.toBe(balanceKey);
      expect(cardLimitsRequestKey(scope(changed), 1)).not.toBe(limitsKey);
    }
    expect(cardBalanceRequestKey(scope(baseScope), 2)).not.toBe(balanceKey);
    expect(cardLimitsRequestKey(scope(baseScope), 2)).not.toBe(limitsKey);
  });

  it("rejects stale success, error and finally after a scope/generation reset", () => {
    const balanceCurrent = cardBalanceReducer(initialCardBalanceState, {
      type: "reset",
      scopeKey: scope(baseScope),
      requestKey: "balance-current",
      loading: true,
    });
    expect(
      cardBalanceReducer(balanceCurrent, {
        type: "loaded",
        requestKey: "balance-stale",
        balance,
      }),
    ).toBe(balanceCurrent);
    expect(
      cardBalanceReducer(balanceCurrent, {
        type: "failed",
        requestKey: "balance-stale",
        message: "stale",
      }),
    ).toBe(balanceCurrent);
    expect(
      cardBalanceReducer(balanceCurrent, { type: "settled", requestKey: "balance-stale" }),
    ).toBe(balanceCurrent);

    const limitsCurrent = cardLimitsReducer(initialCardLimitsState, {
      type: "reset",
      scopeKey: scope(baseScope),
      requestKey: "limits-current",
      loading: true,
    });
    expect(
      cardLimitsReducer(limitsCurrent, {
        type: "loaded",
        requestKey: "limits-stale",
        limits,
      }),
    ).toBe(limitsCurrent);
    expect(
      cardLimitsReducer(limitsCurrent, {
        type: "failed",
        requestKey: "limits-stale",
        message: "stale",
      }),
    ).toBe(limitsCurrent);
    expect(cardLimitsReducer(limitsCurrent, { type: "settled", requestKey: "limits-stale" })).toBe(
      limitsCurrent,
    );
  });
});
