import type { WalletOperationActivity, WalletOperationActivityPage } from "./backend-api";

export type WalletOperationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  items: WalletOperationActivity[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export const initialWalletOperationState: WalletOperationState = {
  scopeKey: null,
  activeRequestKey: null,
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
};

export function walletOperationRequestKey(
  scopeKey: string | null,
  cursor: string | null,
  generation: number,
) {
  return JSON.stringify([scopeKey, cursor, generation]);
}

export function walletOperationViewForScope(state: WalletOperationState, scopeKey: string | null) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletOperationState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletOperationAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loading-more"; requestKey: string }
  | { type: "page"; requestKey: string; page: WalletOperationActivityPage; append: boolean }
  | { type: "failed"; requestKey: string; message: string; append: boolean }
  | { type: "settled"; requestKey: string };

export function walletOperationReducer(
  state: WalletOperationState,
  action: WalletOperationAction,
): WalletOperationState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        items: [],
        nextCursor: null,
        loading: action.loading,
        loadingMore: false,
        error: null,
      };
    case "loading-more":
      return { ...state, activeRequestKey: action.requestKey, loadingMore: true, error: null };
    case "page": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (action.append) {
        const existingIds = new Set(state.items.map((item) => item.id));
        if (action.page.items.some((item) => existingIds.has(item.id))) {
          return {
            ...state,
            nextCursor: null,
            error: "Backend returned duplicate Wallet operation ids",
          };
        }
      }
      return {
        ...state,
        items: action.append ? [...state.items, ...action.page.items] : action.page.items,
        nextCursor: action.page.nextCursor,
        error: null,
      };
    }
    case "failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return {
        ...state,
        items: action.append ? state.items : [],
        nextCursor: action.append ? state.nextCursor : null,
        error: action.message,
      };
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, loading: false, loadingMore: false }
        : state;
  }
}

export function walletOperationErrorMessage(_reason: unknown) {
  return "Wallet activity is unavailable";
}
