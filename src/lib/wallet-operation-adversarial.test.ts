import { describe, expect, it } from "bun:test";
import {
  buildWalletOperationDetailPath,
  buildWalletOperationPath,
  normalizeWalletOperationDetail,
  normalizeWalletOperationResponse,
  type WalletOperationActivity,
} from "./backend-api";
import {
  initialWalletOperationState,
  walletOperationReducer,
  walletOperationRequestKey,
  walletOperationViewForScope,
} from "./wallet-operation-state";
import {
  initialWalletOperationDetailState,
  walletOperationDetailReducer,
  walletOperationDetailRequestKey,
  walletOperationDetailViewForScope,
} from "./wallet-operation-detail-state";

const operationId = "operation:owned.1";
const operationRecord = (id = operationId) => ({
  id,
  type: "INTERNAL_TRANSFER",
  status: "PENDING_SETTLEMENT",
  assetCode: "USD",
  amount: "25.5",
  direction: "BETWEEN_OWN_ACCOUNTS",
  createdAt: "2026-07-31T12:00:00.000Z",
  completedAt: null,
  updatedAt: "2026-07-31T12:00:01+00:00",
});
const operation: WalletOperationActivity = {
  id: operationId,
  type: "internal_transfer",
  status: "pending_settlement",
  assetCode: "USD",
  amount: "25.5",
  direction: "between_own_accounts",
  createdAt: "2026-07-31T12:00:00.000Z",
  completedAt: null,
  updatedAt: "2026-07-31T12:00:01+00:00",
};
const page = (items: unknown = [operationRecord()], nextCursor: unknown = null) => ({
  items,
  nextCursor,
});
const operationCursor = (
  id = operationId,
  createdAt = "2026-07-31T12:00:00.000Z",
  type: "DEPOSIT" | "INTERNAL_TRANSFER" | "WITHDRAWAL" | "FX_CONVERSION" | null = null,
  status: "PROCESSING" | "PENDING_SETTLEMENT" | "COMPLETED" | "FAILED" | null = null,
) => Buffer.from(JSON.stringify({ version: 2, createdAt, id, type, status })).toString("base64url");

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
  new (class OperationResponse {})(),
];

describe("Wallet operation public contract adversarial parser matrix", () => {
  it("rejects non-ordinary page and operation detail containers", () => {
    for (const value of nonOrdinaryObjects) {
      expect(() => normalizeWalletOperationResponse(value)).toThrow();
      expect(() => normalizeWalletOperationDetail(value, { operationId })).toThrow();
    }
  });

  it("requires page and item fields to be own data properties", () => {
    for (const field of ["items", "nextCursor"]) {
      const record: Record<string, unknown> = page();
      delete record[field];
      expect(() => normalizeWalletOperationResponse(record)).toThrow();
    }
    for (const field of Object.keys(operationRecord())) {
      const record: Record<string, unknown> = operationRecord();
      delete record[field];
      expect(() => normalizeWalletOperationDetail(record, { operationId })).toThrow();
    }
  });

  it("never executes required or unknown page/item getters", () => {
    for (const [record, field, normalize] of [
      [page(), "items", (value: unknown) => normalizeWalletOperationResponse(value)],
      [
        operationRecord(),
        "amount",
        (value: unknown) => normalizeWalletOperationDetail(value, { operationId }),
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
      [page(), (value: unknown) => normalizeWalletOperationResponse(value)],
      [
        operationRecord(),
        (value: unknown) => normalizeWalletOperationDetail(value, { operationId }),
      ],
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
    const hole = new Array(1);
    expect(() => normalizeWalletOperationResponse(page(hole))).toThrow();

    const accessor = [operationRecord()];
    let executions = 0;
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get() {
        executions += 1;
        return operationRecord();
      },
    });
    expect(() => normalizeWalletOperationResponse(page(accessor))).toThrow();
    expect(executions).toBe(0);

    class Operations extends Array<unknown> {}
    expect(() =>
      normalizeWalletOperationResponse(page(new Operations(operationRecord()))),
    ).toThrow();
  });

  it("enforces exact enums and maps every published value", () => {
    for (const [field, values] of [
      ["type", ["DEPOSIT", "INTERNAL_TRANSFER", "WITHDRAWAL", "FX_CONVERSION"]],
      ["status", ["PROCESSING", "PENDING_SETTLEMENT", "COMPLETED", "FAILED"]],
      ["direction", ["OUTGOING", "INCOMING", "BETWEEN_OWN_ACCOUNTS"]],
    ] as const) {
      for (const value of values) {
        const detail = normalizeWalletOperationDetail(
          { ...operationRecord(), [field]: value },
          { operationId },
        );
        expect(String(detail[field])).toBe(value.toLowerCase());
      }
      for (const value of ["", values[0]?.toLowerCase(), `${values[0]}_UNKNOWN`, 1, null]) {
        expect(() =>
          normalizeWalletOperationDetail({ ...operationRecord(), [field]: value }, { operationId }),
        ).toThrow();
      }
    }
  });

  it("enforces canonical nonnegative Decimal(36,18) boundaries", () => {
    for (const amount of [
      "0",
      "0.0",
      "1",
      "999999999999999999",
      "0.123456789012345678",
      "999999999999999999.123456789012345678",
    ]) {
      expect(
        normalizeWalletOperationDetail({ ...operationRecord(), amount }, { operationId }).amount,
      ).toBe(amount);
    }
    for (const amount of [
      "-0",
      "-1",
      "+1",
      "01",
      ".1",
      "1.",
      "1e2",
      "1000000000000000000",
      "0.1234567890123456789",
    ]) {
      expect(() =>
        normalizeWalletOperationDetail({ ...operationRecord(), amount }, { operationId }),
      ).toThrow();
    }
  });

  it("enforces RFC3339 including explicit nullable completedAt", () => {
    for (const timestamp of [
      "2024-02-29T23:59:59Z",
      "2026-07-31T08:00:00.123456789+08:00",
      "2026-07-31T00:00:00-05:30",
    ]) {
      const detail = normalizeWalletOperationDetail(
        {
          ...operationRecord(),
          createdAt: timestamp,
          completedAt: timestamp,
          updatedAt: timestamp,
        },
        { operationId },
      );
      expect(detail.createdAt).toBe(timestamp);
      expect(detail.completedAt).toBe(timestamp);
      expect(detail.updatedAt).toBe(timestamp);
    }
    for (const timestamp of [
      undefined,
      "2023-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-07-31T24:00:00Z",
      "2026-07-31T08:60:00Z",
      "2026-07-31T08:00:60Z",
      "2026-07-31",
    ]) {
      expect(() =>
        normalizeWalletOperationDetail(
          { ...operationRecord(), completedAt: timestamp },
          { operationId },
        ),
      ).toThrow();
    }
    expect(
      normalizeWalletOperationDetail({ ...operationRecord(), completedAt: null }, { operationId })
        .completedAt,
    ).toBeNull();
  });

  it("strictly validates opaque cursors and IDs and binds list selection to detail", () => {
    const cursor = operationCursor();
    expect(buildWalletOperationPath({ cursor })).toContain(`cursor=${cursor}`);
    expect(buildWalletOperationDetailPath(operationId)).toBe(
      "/v1/wallet/operations/operation%3Aowned.1",
    );
    for (const cursor of ["", "bad.cursor", "bad:cursor", "bad/cursor", "x".repeat(513)]) {
      expect(() => buildWalletOperationPath({ cursor })).toThrow();
    }
    for (const id of ["", "x", "bad/id", "bad id", "bad$id", "x".repeat(129)]) {
      expect(() => buildWalletOperationDetailPath(id)).toThrow();
    }

    const listed = normalizeWalletOperationResponse(page()).items[0];
    expect(listed).toBeDefined();
    if (!listed) throw new Error("operation fixture missing");
    expect(normalizeWalletOperationDetail(operationRecord(), { operationId: listed.id }).id).toBe(
      listed.id,
    );
    expect(() =>
      normalizeWalletOperationDetail(operationRecord("operation:other.1"), {
        operationId: listed.id,
      }),
    ).toThrow("different Wallet operation id");
  });
});

const scope = (parts: readonly string[]) => JSON.stringify(parts);
const activityScope: readonly string[] = ["actor-a", "tenant-a", "customer-a", "SANDBOX"];
const detailScope: readonly string[] = [...activityScope, operationId];
const activityFilterKey = '[1,"ALL","ALL"]';

describe("Wallet operation adversarial scope and generation matrix", () => {
  it("synchronously clears each prior list/detail when one scope dimension changes", () => {
    const listState = {
      ...initialWalletOperationState,
      scopeKey: scope(activityScope),
      filterKey: activityFilterKey,
      activeRequestKey: "list-old",
      items: [operation],
      nextCursor: "cursor-old",
    };
    for (let index = 0; index < activityScope.length; index += 1) {
      const changed = [...activityScope];
      changed[index] = `${changed[index]}-changed`;
      expect(
        walletOperationViewForScope(listState, scope(changed), activityFilterKey).items,
      ).toEqual([]);
    }

    const detailState = {
      ...initialWalletOperationDetailState,
      scopeKey: scope(detailScope),
      activeRequestKey: "detail-old",
      detail: operation,
    };
    for (let index = 0; index < detailScope.length; index += 1) {
      const changed = [...detailScope];
      changed[index] = `${changed[index]}-changed`;
      expect(walletOperationDetailViewForScope(detailState, scope(changed)).detail).toBeNull();
    }
  });

  it("changes request keys for every scope dimension, cursor, and generation", () => {
    const listKey = walletOperationRequestKey(scope(activityScope), activityFilterKey, null, 1);
    for (let index = 0; index < activityScope.length; index += 1) {
      const changed = [...activityScope];
      changed[index] = `${changed[index]}-changed`;
      expect(walletOperationRequestKey(scope(changed), activityFilterKey, null, 1)).not.toBe(
        listKey,
      );
    }
    expect(
      walletOperationRequestKey(scope(activityScope), activityFilterKey, "cursor-1", 1),
    ).not.toBe(listKey);
    expect(walletOperationRequestKey(scope(activityScope), activityFilterKey, null, 2)).not.toBe(
      listKey,
    );

    const detailKey = walletOperationDetailRequestKey(scope(detailScope), 1);
    for (let index = 0; index < detailScope.length; index += 1) {
      const changed = [...detailScope];
      changed[index] = `${changed[index]}-changed`;
      expect(walletOperationDetailRequestKey(scope(changed), 1)).not.toBe(detailKey);
    }
    expect(walletOperationDetailRequestKey(scope(detailScope), 2)).not.toBe(detailKey);
  });

  it("rejects stale success, error and finally after scope/generation reset", () => {
    const listCurrent = walletOperationReducer(initialWalletOperationState, {
      type: "reset",
      scopeKey: scope(activityScope),
      filterKey: activityFilterKey,
      requestKey: "list-current",
      loading: true,
    });
    expect(
      walletOperationReducer(listCurrent, {
        type: "page",
        requestKey: "list-stale",
        requestCursor: null,
        page: { items: [operation], nextCursor: "cursor-stale" },
        append: false,
      }),
    ).toBe(listCurrent);
    expect(
      walletOperationReducer(listCurrent, {
        type: "failed",
        requestKey: "list-stale",
        message: "stale",
        append: false,
      }),
    ).toBe(listCurrent);
    expect(walletOperationReducer(listCurrent, { type: "settled", requestKey: "list-stale" })).toBe(
      listCurrent,
    );

    const detailCurrent = walletOperationDetailReducer(initialWalletOperationDetailState, {
      type: "reset",
      scopeKey: scope(detailScope),
      requestKey: "detail-current",
      loading: true,
    });
    expect(
      walletOperationDetailReducer(detailCurrent, {
        type: "loaded",
        requestKey: "detail-stale",
        detail: operation,
      }),
    ).toBe(detailCurrent);
    expect(
      walletOperationDetailReducer(detailCurrent, {
        type: "failed",
        requestKey: "detail-stale",
        message: "stale",
      }),
    ).toBe(detailCurrent);
    expect(
      walletOperationDetailReducer(detailCurrent, {
        type: "settled",
        requestKey: "detail-stale",
      }),
    ).toBe(detailCurrent);
  });
});
