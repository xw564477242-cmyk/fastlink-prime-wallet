import { describe, expect, it } from "bun:test";
import type { WalletAccountTransaction } from "./backend-api";
import { walletTransactionSelectionForSnapshot } from "./wallet-transaction-selection-state";

function transaction(
  id: string,
  patch: Partial<WalletAccountTransaction> = {},
): WalletAccountTransaction {
  return {
    id,
    type: "transfer",
    status: "completed",
    assetCode: "USD",
    amount: "25.5",
    direction: "outgoing",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:01.000Z",
    ...patch,
  };
}

describe("Wallet transaction refreshed snapshot selection", () => {
  it("clears an ID that is absent from the refreshed first page", () => {
    expect(walletTransactionSelectionForSnapshot("tx-old", "USD", [transaction("tx-new")])).toEqual(
      { selectedId: null, transaction: null },
    );
  });

  it("binds a surviving ID only to the refreshed public record", () => {
    const oldRecord = transaction("tx-shared", { amount: "25.5" });
    const refreshedRecord = transaction("tx-shared", {
      amount: "30",
      status: "pending",
      updatedAt: "2026-08-01T01:00:00.000Z",
    });
    const selection = walletTransactionSelectionForSnapshot("tx-shared", "USD", [refreshedRecord]);

    expect(selection.selectedId).toBe("tx-shared");
    expect(selection.transaction).toBe(refreshedRecord);
    expect(selection.transaction).not.toBe(oldRecord);
    expect(selection.transaction?.amount).toBe("30");
  });

  it("fails closed for a different account or duplicate selected ID", () => {
    expect(
      walletTransactionSelectionForSnapshot("tx-shared", "USD", [
        transaction("tx-shared", { assetCode: "EUR" }),
      ]),
    ).toEqual({ selectedId: null, transaction: null });
    expect(
      walletTransactionSelectionForSnapshot("tx-shared", "USD", [
        transaction("tx-shared"),
        transaction("tx-shared", { updatedAt: "2026-08-01T01:00:00.000Z" }),
      ]),
    ).toEqual({ selectedId: null, transaction: null });
  });

  it("keeps no selection when identity or account scope is unavailable", () => {
    expect(walletTransactionSelectionForSnapshot(null, "USD", [transaction("tx")])).toEqual({
      selectedId: null,
      transaction: null,
    });
    expect(walletTransactionSelectionForSnapshot("tx", null, [transaction("tx")])).toEqual({
      selectedId: null,
      transaction: null,
    });
  });
});
