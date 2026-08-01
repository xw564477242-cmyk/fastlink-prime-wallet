import type { WalletAccountTransaction } from "./backend-api";

export type WalletTransactionSelection = Readonly<{
  selectedId: string | null;
  transaction: WalletAccountTransaction | null;
}>;

export function walletTransactionSelectionForSnapshot(
  selectedId: string | null,
  selectedAssetCode: string | null,
  items: readonly WalletAccountTransaction[],
): WalletTransactionSelection {
  if (!selectedId || !selectedAssetCode) {
    return { selectedId: null, transaction: null };
  }
  const matches = items.filter(
    (item) => item.id === selectedId && item.assetCode === selectedAssetCode,
  );
  return matches.length === 1
    ? { selectedId, transaction: matches[0] }
    : { selectedId: null, transaction: null };
}
