import type { WalletAccountTransaction, WalletAccountTransactionPage } from "./backend-api";

export type WalletTransactionState = {
  scopeKey: string | null;
  requestId: number;
  items: WalletAccountTransaction[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export const initialWalletTransactionState: WalletTransactionState = {
  scopeKey: null,
  requestId: 0,
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
};

export function walletTransactionViewForScope(
  state: WalletTransactionState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletTransactionState,
    scopeKey,
    requestId: state.requestId,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletTransactionAction =
  | { type: "reset"; scopeKey: string | null; requestId: number; loading: boolean }
  | { type: "loading-more"; requestId: number }
  | { type: "page"; requestId: number; page: WalletAccountTransactionPage; append: boolean }
  | { type: "failed"; requestId: number; message: string; append: boolean };

function mergeItems(current: WalletAccountTransaction[], incoming: WalletAccountTransaction[]) {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()];
}

export function walletTransactionReducer(
  state: WalletTransactionState,
  action: WalletTransactionAction,
): WalletTransactionState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        requestId: action.requestId,
        items: [],
        nextCursor: null,
        loading: action.loading,
        loadingMore: false,
        error: null,
      };
    case "loading-more":
      return { ...state, requestId: action.requestId, loadingMore: true, error: null };
    case "page":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        items: action.append ? mergeItems(state.items, action.page.items) : action.page.items,
        nextCursor: action.page.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      };
    case "failed":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        items: action.append ? state.items : [],
        nextCursor: action.append ? state.nextCursor : null,
        loading: false,
        loadingMore: false,
        error: action.message,
      };
  }
}
