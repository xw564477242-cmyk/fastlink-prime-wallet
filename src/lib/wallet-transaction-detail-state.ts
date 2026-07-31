import type { BackendSession, WalletAccountTransaction } from "./backend-api";

export type WalletTransactionDetailState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  detail: WalletAccountTransaction | null;
  loading: boolean;
  error: string | null;
};

export const initialWalletTransactionDetailState: WalletTransactionDetailState = {
  scopeKey: null,
  activeRequestKey: null,
  detail: null,
  loading: false,
  error: null,
};

export function walletTransactionDetailErrorMessage(_reason: unknown) {
  return "Wallet transaction detail is unavailable";
}

export function walletTransactionPublicVersion(transaction: WalletAccountTransaction): string {
  return JSON.stringify([
    transaction.id,
    transaction.type,
    transaction.status,
    transaction.assetCode,
    transaction.amount,
    transaction.direction,
    transaction.createdAt,
    transaction.updatedAt,
  ]);
}

export function walletTransactionDetailScopeKey(
  session: BackendSession | null,
  selectedAssetCode: string | null,
  selectedTransaction: WalletAccountTransaction | null,
  historyScopeKey: string | null,
): string | null {
  if (
    !session ||
    !selectedAssetCode ||
    !selectedTransaction ||
    !historyScopeKey ||
    selectedTransaction.assetCode !== selectedAssetCode
  ) {
    return null;
  }
  return JSON.stringify([
    historyScopeKey,
    session.actorId,
    session.expiresAt ?? null,
    session.tenantId,
    session.customerId,
    session.environment,
    selectedAssetCode,
    walletTransactionPublicVersion(selectedTransaction),
  ]);
}

export function walletTransactionDetailRequestKey(scopeKey: string, generation: number): string {
  return JSON.stringify([scopeKey, generation]);
}

export function walletTransactionDetailViewForScope(
  state: WalletTransactionDetailState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletTransactionDetailState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletTransactionDetailAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "begin"; scopeKey: string; requestKey: string }
  | { type: "loaded"; requestKey: string; detail: WalletAccountTransaction }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function walletTransactionDetailReducer(
  state: WalletTransactionDetailState,
  action: WalletTransactionDetailAction,
): WalletTransactionDetailState {
  switch (action.type) {
    case "reset":
      return {
        ...initialWalletTransactionDetailState,
        scopeKey: action.scopeKey,
      };
    case "begin":
      if (action.scopeKey !== state.scopeKey) return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        detail: null,
        loading: true,
        error: null,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, detail: action.detail, error: null }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, detail: null, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey ? { ...state, loading: false } : state;
  }
}
