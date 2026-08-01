import type { WalletAccountTransaction, WalletAccountTransactionPage } from "./backend-api";

export type WalletTransactionState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  items: WalletAccountTransaction[];
  nextCursor: string | null;
  seenCursors: string[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
};

export const initialWalletTransactionState: WalletTransactionState = {
  scopeKey: null,
  activeRequestKey: null,
  items: [],
  nextCursor: null,
  seenCursors: [],
  loading: false,
  loadingMore: false,
  refreshing: false,
  error: null,
  refreshError: null,
};

export function walletTransactionViewForScope(
  state: WalletTransactionState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletTransactionState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export function walletTransactionRequestKey(
  scopeKey: string,
  requestCursor: string | null,
  generation: number,
): string {
  return JSON.stringify([scopeKey, requestCursor, generation]);
}

export type WalletTransactionAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loading-more"; requestKey: string; requestCursor: string }
  | { type: "refreshing"; scopeKey: string; requestKey: string }
  | {
      type: "refreshed";
      requestKey: string;
      page: WalletAccountTransactionPage;
    }
  | { type: "refresh-failed"; requestKey: string; message: string }
  | {
      type: "page";
      requestKey: string;
      requestCursor: string | null;
      page: WalletAccountTransactionPage;
      append: boolean;
    }
  | { type: "failed"; requestKey: string; message: string; append: boolean }
  | { type: "settled"; requestKey: string };

function paginationFailure(state: WalletTransactionState): WalletTransactionState {
  return {
    ...state,
    loading: false,
    loadingMore: false,
    error: "Backend returned inconsistent Wallet transaction pagination",
  };
}

export function walletTransactionReducer(
  state: WalletTransactionState,
  action: WalletTransactionAction,
): WalletTransactionState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        items: [],
        nextCursor: null,
        seenCursors: [],
        loading: action.loading,
        loadingMore: false,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    case "loading-more":
      if (action.requestCursor !== state.nextCursor) return paginationFailure(state);
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: true,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    case "refreshing":
      if (action.scopeKey !== state.scopeKey || state.loading) return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: false,
        refreshing: true,
        refreshError: null,
      };
    case "refreshed": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (new Set(action.page.items.map((item) => item.id)).size !== action.page.items.length) {
        return {
          ...state,
          refreshing: false,
          refreshError: "Backend returned inconsistent Wallet transaction pagination",
        };
      }
      return {
        ...state,
        items: action.page.items,
        nextCursor: action.page.nextCursor,
        seenCursors: action.page.nextCursor === null ? [] : [action.page.nextCursor],
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    }
    case "refresh-failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return {
        ...state,
        loadingMore: false,
        refreshing: false,
        refreshError: action.message,
      };
    case "page": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (new Set(action.page.items.map((item) => item.id)).size !== action.page.items.length) {
        return paginationFailure(state);
      }
      if (action.append && action.requestCursor !== state.nextCursor) {
        return paginationFailure(state);
      }
      if (action.append) {
        const currentIds = new Set(state.items.map((item) => item.id));
        if (action.page.items.some((item) => currentIds.has(item.id))) {
          return paginationFailure(state);
        }
      }
      if (
        action.page.nextCursor !== null &&
        (action.page.nextCursor === action.requestCursor ||
          state.seenCursors.includes(action.page.nextCursor))
      ) {
        return paginationFailure(state);
      }
      return {
        ...state,
        items: action.append ? [...state.items, ...action.page.items] : action.page.items,
        nextCursor: action.page.nextCursor,
        seenCursors:
          action.page.nextCursor === null
            ? state.seenCursors
            : [...state.seenCursors, action.page.nextCursor],
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
