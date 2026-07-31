import type { WalletAccountTransaction } from "./backend-api";

export type WalletTransactionDetailState = {
  scopeKey: string | null;
  requestId: number;
  detail: WalletAccountTransaction | null;
  loading: boolean;
  error: string | null;
};

export const initialWalletTransactionDetailState: WalletTransactionDetailState = {
  scopeKey: null,
  requestId: 0,
  detail: null,
  loading: false,
  error: null,
};

export function walletTransactionDetailErrorMessage(_reason: unknown) {
  return "Wallet transaction detail is unavailable";
}

export function walletTransactionDetailViewForScope(
  state: WalletTransactionDetailState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletTransactionDetailState,
    scopeKey,
    requestId: state.requestId,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletTransactionDetailAction =
  | { type: "reset"; scopeKey: string | null; requestId: number; loading: boolean }
  | { type: "loaded"; requestId: number; detail: WalletAccountTransaction }
  | { type: "failed"; requestId: number; message: string }
  | { type: "settled"; requestId: number };

export function walletTransactionDetailReducer(
  state: WalletTransactionDetailState,
  action: WalletTransactionDetailAction,
): WalletTransactionDetailState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        requestId: action.requestId,
        detail: null,
        loading: action.loading,
        error: null,
      };
    case "loaded":
      return action.requestId === state.requestId
        ? { ...state, detail: action.detail, error: null }
        : state;
    case "failed":
      return action.requestId === state.requestId
        ? { ...state, detail: null, error: action.message }
        : state;
    case "settled":
      return action.requestId === state.requestId ? { ...state, loading: false } : state;
  }
}
