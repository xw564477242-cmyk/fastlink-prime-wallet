import type { WalletAssetAccount } from "./backend-api";

export type WalletAccountState = {
  sessionKey: string | null;
  requestId: number;
  accounts: WalletAssetAccount[];
  selectedAssetCode: string | null;
  loading: boolean;
  error: string | null;
};

export const initialWalletAccountState: WalletAccountState = {
  sessionKey: null,
  requestId: 0,
  accounts: [],
  selectedAssetCode: null,
  loading: false,
  error: null,
};

export function walletAccountViewForSession(state: WalletAccountState, sessionKey: string | null) {
  if (state.sessionKey === sessionKey) return { ...state, scopeReady: true };
  return {
    ...initialWalletAccountState,
    sessionKey,
    requestId: state.requestId,
    loading: sessionKey !== null,
    scopeReady: false,
  };
}

export type WalletAccountAction =
  | { type: "reset"; sessionKey: string | null; requestId: number; loading: boolean }
  | { type: "loaded"; requestId: number; accounts: WalletAssetAccount[] }
  | { type: "failed"; requestId: number; message: string }
  | { type: "select"; sessionKey: string | null; assetCode: string };

export function walletAccountReducer(
  state: WalletAccountState,
  action: WalletAccountAction,
): WalletAccountState {
  switch (action.type) {
    case "reset":
      return {
        sessionKey: action.sessionKey,
        requestId: action.requestId,
        accounts: [],
        selectedAssetCode: null,
        loading: action.loading,
        error: null,
      };
    case "loaded":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        accounts: action.accounts,
        selectedAssetCode: action.accounts[0]?.assetCode ?? null,
        loading: false,
        error: null,
      };
    case "failed":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        accounts: [],
        selectedAssetCode: null,
        loading: false,
        error: action.message,
      };
    case "select":
      return action.sessionKey === state.sessionKey &&
        state.accounts.some((account) => account.assetCode === action.assetCode)
        ? { ...state, selectedAssetCode: action.assetCode }
        : state;
  }
}
