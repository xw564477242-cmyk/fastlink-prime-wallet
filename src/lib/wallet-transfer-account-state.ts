import {
  walletTransferSessionAllowed,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletTransferAccount,
} from "./backend-api";

export type WalletTransferAccountState = {
  scopeKey: string | null;
  requestKey: string | null;
  accounts: WalletTransferAccount[];
  loading: boolean;
  error: string | null;
};

export const initialWalletTransferAccountState: WalletTransferAccountState = {
  scopeKey: null,
  requestKey: null,
  accounts: [],
  loading: false,
  error: null,
};

export function walletTransferAccountScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): string | null {
  return walletTransferSessionAllowed(session, runtimeEnvironment, now) && session
    ? JSON.stringify([
        session.actorId,
        session.expiresAt,
        session.tenantId,
        session.customerId,
        session.environment,
        runtimeEnvironment,
      ])
    : null;
}

export function walletTransferAccountView(
  state: WalletTransferAccountState,
  scopeKey: string | null,
): WalletTransferAccountState {
  return state.scopeKey === scopeKey
    ? state
    : {
        ...initialWalletTransferAccountState,
        scopeKey,
        loading: scopeKey !== null,
      };
}

export type WalletTransferAccountAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null }
  | { type: "loaded"; requestKey: string; accounts: WalletTransferAccount[] }
  | { type: "failed"; requestKey: string }
  | { type: "settled"; requestKey: string };

export function walletTransferAccountReducer(
  state: WalletTransferAccountState,
  action: WalletTransferAccountAction,
): WalletTransferAccountState {
  switch (action.type) {
    case "reset":
      return {
        scopeKey: action.scopeKey,
        requestKey: action.requestKey,
        accounts: [],
        loading: action.scopeKey !== null,
        error: null,
      };
    case "loaded":
      return action.requestKey === state.requestKey
        ? { ...state, accounts: action.accounts, error: null }
        : state;
    case "failed":
      return action.requestKey === state.requestKey
        ? { ...state, accounts: [], error: "Wallet accounts are unavailable" }
        : state;
    case "settled":
      return action.requestKey === state.requestKey ? { ...state, loading: false } : state;
  }
}
