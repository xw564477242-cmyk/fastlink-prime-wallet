import type { WalletOperationActivity } from "./backend-api";

export type WalletOperationDetailState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  detail: WalletOperationActivity | null;
  loading: boolean;
  error: string | null;
};

export const initialWalletOperationDetailState: WalletOperationDetailState = {
  scopeKey: null,
  activeRequestKey: null,
  detail: null,
  loading: false,
  error: null,
};

export function walletOperationDetailRequestKey(scopeKey: string, generation: number) {
  return JSON.stringify([scopeKey, generation]);
}

export function walletOperationDetailErrorMessage(_reason: unknown) {
  return "Wallet operation detail is unavailable";
}

export function walletOperationDetailViewForScope(
  state: WalletOperationDetailState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletOperationDetailState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletOperationDetailAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loaded"; requestKey: string; detail: WalletOperationActivity }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function walletOperationDetailReducer(
  state: WalletOperationDetailState,
  action: WalletOperationDetailAction,
): WalletOperationDetailState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        detail: null,
        loading: action.loading,
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
