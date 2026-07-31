import type { WalletCardBalance } from "./backend-api";

export type CardBalanceState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  balance: WalletCardBalance | null;
  loading: boolean;
  error: string | null;
};

export const initialCardBalanceState: CardBalanceState = {
  scopeKey: null,
  activeRequestKey: null,
  balance: null,
  loading: false,
  error: null,
};

export function cardBalanceRequestKey(scopeKey: string, generation: number) {
  return JSON.stringify([scopeKey, generation]);
}

export function cardBalanceErrorMessage(_reason: unknown) {
  return "Card balance is unavailable";
}

export function cardBalanceViewForScope(state: CardBalanceState, scopeKey: string | null) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardBalanceState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type CardBalanceAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loaded"; requestKey: string; balance: WalletCardBalance }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardBalanceReducer(
  state: CardBalanceState,
  action: CardBalanceAction,
): CardBalanceState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        balance: null,
        loading: action.loading,
        error: null,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, balance: action.balance, error: null }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, balance: null, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey ? { ...state, loading: false } : state;
  }
}
