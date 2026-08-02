import type { WalletOperationActivity, WalletOperationActivityPage } from "./backend-api";

export type WalletOperationState = {
  scopeKey: string | null;
  filterKey: string | null;
  activeRequestKey: string | null;
  items: WalletOperationActivity[];
  nextCursor: string | null;
  cursorTrail: string[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
};

export const initialWalletOperationState: WalletOperationState = {
  scopeKey: null,
  filterKey: null,
  activeRequestKey: null,
  items: [],
  nextCursor: null,
  cursorTrail: [],
  loading: false,
  loadingMore: false,
  refreshing: false,
  error: null,
  refreshError: null,
};

export function walletOperationRequestKey(
  scopeKey: string | null,
  filterKey: string,
  cursor: string | null,
  generation: number,
) {
  return JSON.stringify([scopeKey, filterKey, cursor, generation]);
}

export function walletOperationViewForScope(
  state: WalletOperationState,
  scopeKey: string | null,
  filterKey: string,
) {
  if (state.scopeKey === scopeKey && state.filterKey === filterKey)
    return { ...state, scopeReady: true };
  return {
    ...initialWalletOperationState,
    scopeKey,
    filterKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type WalletOperationAction =
  | {
      type: "reset";
      scopeKey: string | null;
      filterKey: string;
      requestKey: string | null;
      loading: boolean;
    }
  | { type: "loading-more"; requestKey: string; requestCursor: string }
  | { type: "refreshing"; scopeKey: string; filterKey: string; requestKey: string }
  | { type: "refreshed"; requestKey: string; page: WalletOperationActivityPage }
  | { type: "refresh-failed"; requestKey: string; message: string }
  | {
      type: "page";
      requestKey: string;
      requestCursor: string | null;
      page: WalletOperationActivityPage;
      append: boolean;
    }
  | { type: "failed"; requestKey: string; message: string; append: boolean }
  | { type: "settled"; requestKey: string | null };

function paginationFailure(state: WalletOperationState): WalletOperationState {
  return {
    ...state,
    nextCursor: null,
    loading: false,
    loadingMore: false,
    refreshing: false,
    error: "Backend returned inconsistent Wallet operation pagination",
  };
}

export function walletOperationReducer(
  state: WalletOperationState,
  action: WalletOperationAction,
): WalletOperationState {
  switch (action.type) {
    case "reset":
      return {
        ...initialWalletOperationState,
        scopeKey: action.scopeKey,
        filterKey: action.filterKey,
        activeRequestKey: action.requestKey,
        loading: action.loading,
      };
    case "loading-more":
      if (
        action.requestCursor !== state.nextCursor ||
        state.cursorTrail.at(-1) !== action.requestCursor
      )
        return paginationFailure(state);
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: true,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    case "refreshing":
      if (
        action.scopeKey !== state.scopeKey ||
        action.filterKey !== state.filterKey ||
        state.loading
      )
        return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: false,
        refreshing: true,
        refreshError: null,
      };
    case "refreshed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return {
        ...state,
        items: action.page.items,
        nextCursor: action.page.nextCursor,
        cursorTrail: action.page.nextCursor === null ? [] : [action.page.nextCursor],
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    case "refresh-failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return { ...state, refreshing: false, refreshError: action.message };
    case "page": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (action.append && action.requestCursor !== state.nextCursor)
        return paginationFailure(state);
      const currentIds = new Set(state.items.map((item) => item.id));
      if (action.append && action.page.items.some((item) => currentIds.has(item.id)))
        return paginationFailure(state);
      if (
        action.page.nextCursor !== null &&
        (action.page.nextCursor === action.requestCursor ||
          state.cursorTrail.includes(action.page.nextCursor))
      )
        return paginationFailure(state);
      return {
        ...state,
        items: action.append ? [...state.items, ...action.page.items] : action.page.items,
        nextCursor: action.page.nextCursor,
        cursorTrail:
          action.page.nextCursor === null
            ? state.cursorTrail
            : [...state.cursorTrail, action.page.nextCursor],
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    }
    case "failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return {
        ...state,
        items: action.append ? state.items : [],
        nextCursor: action.append ? state.nextCursor : null,
        loading: false,
        loadingMore: false,
        error: action.message,
      };
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, loading: false, loadingMore: false, refreshing: false }
        : state;
  }
}

export function walletOperationErrorMessage(_reason: unknown) {
  return "Wallet activity is unavailable";
}
