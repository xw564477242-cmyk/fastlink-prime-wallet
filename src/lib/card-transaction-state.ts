import type { WalletCardTransaction, WalletCardTransactionPage } from "./backend-api";

export type CardTransactionState = {
  scopeKey: string | null;
  requestId: number;
  transactions: WalletCardTransaction[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export const initialCardTransactionState: CardTransactionState = {
  scopeKey: null,
  requestId: 0,
  transactions: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
};

export type CardTransactionView = CardTransactionState & { scopeReady: boolean };

export function cardTransactionViewForScope(
  state: CardTransactionState,
  scopeKey: string | null,
): CardTransactionView {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardTransactionState,
    scopeKey,
    requestId: state.requestId,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type CardTransactionAction =
  | { type: "reset"; scopeKey: string | null; requestId: number; loading: boolean }
  | { type: "loading-more"; requestId: number }
  | { type: "page"; requestId: number; page: WalletCardTransactionPage; append: boolean }
  | { type: "failed"; requestId: number; message: string; append: boolean };

function mergeTransactions(
  current: WalletCardTransaction[],
  incoming: WalletCardTransaction[],
): WalletCardTransaction[] {
  const transactions = new Map(current.map((transaction) => [transaction.id, transaction]));
  for (const transaction of incoming) transactions.set(transaction.id, transaction);
  return [...transactions.values()];
}

export function cardTransactionReducer(
  state: CardTransactionState,
  action: CardTransactionAction,
): CardTransactionState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        requestId: action.requestId,
        transactions: [],
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
        transactions: action.append
          ? mergeTransactions(state.transactions, action.page.transactions)
          : action.page.transactions,
        nextCursor: action.page.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      };
    case "failed":
      if (action.requestId !== state.requestId) return state;
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
