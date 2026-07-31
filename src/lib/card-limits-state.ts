import type { WalletCardLimits } from "./backend-api";

export type CardLimitsState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  limits: WalletCardLimits | null;
  loading: boolean;
  error: string | null;
};

export const initialCardLimitsState: CardLimitsState = {
  scopeKey: null,
  activeRequestKey: null,
  limits: null,
  loading: false,
  error: null,
};

export function cardLimitsRequestKey(scopeKey: string, generation: number) {
  return JSON.stringify([scopeKey, generation]);
}

export function cardLimitsErrorMessage(_reason: unknown) {
  return "Card limits are unavailable";
}

export function cardLimitsViewForScope(state: CardLimitsState, scopeKey: string | null) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardLimitsState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type CardLimitsAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loaded"; requestKey: string; limits: WalletCardLimits }
  | { type: "replace-current"; scopeKey: string; limits: WalletCardLimits }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardLimitsReducer(
  state: CardLimitsState,
  action: CardLimitsAction,
): CardLimitsState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        limits: null,
        loading: action.loading,
        error: null,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, limits: action.limits, error: null }
        : state;
    case "replace-current":
      return action.scopeKey === state.scopeKey
        ? {
            ...state,
            activeRequestKey: null,
            limits: action.limits,
            loading: false,
            error: null,
          }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, limits: null, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey ? { ...state, loading: false } : state;
  }
}
