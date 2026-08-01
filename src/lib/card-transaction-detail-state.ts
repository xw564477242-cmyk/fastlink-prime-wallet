import type { BackendSession, CardTransactionFilter, WalletCardTransaction } from "./backend-api";

export type CardTransactionDetailState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  detail: WalletCardTransaction | null;
  loading: boolean;
  error: string | null;
};

export const initialCardTransactionDetailState: CardTransactionDetailState = {
  scopeKey: null,
  activeRequestKey: null,
  detail: null,
  loading: false,
  error: null,
};

export function cardTransactionDetailErrorMessage(_reason: unknown): string {
  return "Card transaction detail is unavailable";
}

export function cardTransactionPublicVersion(transaction: WalletCardTransaction): string {
  return JSON.stringify([
    transaction.id,
    transaction.status,
    transaction.amountMinor,
    transaction.currency,
    transaction.merchant,
    transaction.category,
    transaction.timestamp,
  ]);
}

export function cardTransactionDetailScopeKey(
  session: BackendSession | null,
  cardId: string | null,
  filter: CardTransactionFilter,
  selectedTransaction: WalletCardTransaction | null,
  historyScopeKey: string | null,
): string | null {
  if (!session || !cardId || !selectedTransaction || !historyScopeKey) return null;
  return JSON.stringify([
    historyScopeKey,
    session.actorId,
    session.expiresAt ?? null,
    session.tenantId,
    session.customerId,
    session.environment,
    cardId,
    filter,
    cardTransactionPublicVersion(selectedTransaction),
  ]);
}

export function cardTransactionDetailRequestKey(scopeKey: string, generation: number): string {
  return JSON.stringify([scopeKey, generation]);
}

export function cardTransactionDetailViewForScope(
  state: CardTransactionDetailState,
  scopeKey: string | null,
) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardTransactionDetailState,
    scopeKey,
    scopeReady: false,
  };
}

export type CardTransactionDetailAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "begin"; scopeKey: string; requestKey: string }
  | { type: "loaded"; requestKey: string; detail: WalletCardTransaction }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardTransactionDetailReducer(
  state: CardTransactionDetailState,
  action: CardTransactionDetailAction,
): CardTransactionDetailState {
  switch (action.type) {
    case "reset":
      return { ...initialCardTransactionDetailState, scopeKey: action.scopeKey };
    case "begin":
      if (action.scopeKey !== state.scopeKey) return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loading: true,
        error: null,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, detail: action.detail, error: null }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey ? { ...state, loading: false } : state;
  }
}
