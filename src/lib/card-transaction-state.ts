import type { WalletCardTransaction, WalletCardTransactionPage } from "./backend-api";

export const CARD_TRANSACTION_PAGINATION_ERROR =
  "Backend returned inconsistent Card transaction pagination";

export type CardTransactionState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  transactions: WalletCardTransaction[];
  nextCursor: string | null;
  seenCursors: string[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export const initialCardTransactionState: CardTransactionState = {
  scopeKey: null,
  activeRequestKey: null,
  transactions: [],
  nextCursor: null,
  seenCursors: [],
  loading: false,
  loadingMore: false,
  error: null,
};

export function cardTransactionRequestKey(
  scopeKey: string,
  requestCursor: string | null,
  generation: number,
): string {
  return JSON.stringify([scopeKey, requestCursor, generation]);
}

export type CardTransactionView = CardTransactionState & { scopeReady: boolean };

export function cardTransactionViewForScope(
  state: CardTransactionState,
  scopeKey: string | null,
): CardTransactionView {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardTransactionState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type CardTransactionAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loading-more"; requestKey: string; requestCursor: string }
  | {
      type: "page";
      requestKey: string;
      requestCursor: string | null;
      page: WalletCardTransactionPage;
      append: boolean;
    }
  | {
      type: "failed";
      requestKey: string;
      message: string;
      append: boolean;
    };

function paginationFailure(state: CardTransactionState): CardTransactionState {
  return {
    ...state,
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: CARD_TRANSACTION_PAGINATION_ERROR,
  };
}

function hasDuplicateIds(transactions: WalletCardTransaction[]): boolean {
  return new Set(transactions.map((transaction) => transaction.id)).size !== transactions.length;
}

export function cardTransactionReducer(
  state: CardTransactionState,
  action: CardTransactionAction,
): CardTransactionState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        transactions: [],
        nextCursor: null,
        seenCursors: [],
        loading: action.loading,
        loadingMore: false,
        error: null,
      };
    case "loading-more":
      if (action.requestCursor !== state.nextCursor) return paginationFailure(state);
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: true,
        error: null,
      };
    case "page": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (hasDuplicateIds(action.page.transactions)) return paginationFailure(state);
      if (action.append && action.requestCursor !== state.nextCursor) {
        return paginationFailure(state);
      }

      if (action.append) {
        const currentIds = new Set(state.transactions.map((transaction) => transaction.id));
        if (action.page.transactions.some((transaction) => currentIds.has(transaction.id))) {
          return paginationFailure(state);
        }
      }

      const nextCursor = action.page.nextCursor;
      if (
        nextCursor !== null &&
        (nextCursor === action.requestCursor || state.seenCursors.includes(nextCursor))
      ) {
        return paginationFailure(state);
      }

      return {
        ...state,
        transactions: action.append
          ? [...state.transactions, ...action.page.transactions]
          : action.page.transactions,
        nextCursor,
        seenCursors: nextCursor === null ? state.seenCursors : [...state.seenCursors, nextCursor],
        loading: false,
        loadingMore: false,
        error: null,
      };
    }
    case "failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return {
        ...state,
        transactions: action.append ? state.transactions : [],
        nextCursor: action.append ? state.nextCursor : null,
        loading: false,
        loadingMore: false,
        error: action.message,
      };
  }
}
