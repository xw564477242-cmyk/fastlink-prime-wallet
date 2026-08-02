import {
  walletTransferSessionAllowed,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletAssetAccount,
} from "./backend-api";

export type HomeWalletBalanceState = {
  scopeKey: string | null;
  requestKey: string | null;
  accounts: WalletAssetAccount[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
};

export const initialHomeWalletBalanceState: HomeWalletBalanceState = {
  scopeKey: null,
  requestKey: null,
  accounts: [],
  loading: false,
  refreshing: false,
  error: null,
  refreshError: null,
};

export function homeWalletBalanceReadAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  apiUrl: string,
  now = Date.now(),
): boolean {
  return apiUrl === "/api" && walletTransferSessionAllowed(session, runtimeEnvironment, now);
}

export function homeWalletBalanceScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  apiUrl: string,
  now = Date.now(),
  sessionGeneration = 0,
): string | null {
  return homeWalletBalanceReadAllowed(session, runtimeEnvironment, apiUrl, now) && session
    ? JSON.stringify([
        sessionGeneration,
        session.actorId,
        session.expiresAt,
        session.tenantId,
        session.customerId,
        session.environment,
        runtimeEnvironment,
        apiUrl,
      ])
    : null;
}

export function homeWalletBalanceView(
  state: HomeWalletBalanceState,
  scopeKey: string | null,
): HomeWalletBalanceState & { scopeReady: boolean } {
  return state.scopeKey === scopeKey
    ? { ...state, scopeReady: true }
    : {
        ...initialHomeWalletBalanceState,
        scopeKey,
        loading: scopeKey !== null,
        scopeReady: false,
      };
}

export type HomeWalletBalanceAction =
  | { type: "reset"; scopeKey: string | null }
  | {
      type: "begin";
      scopeKey: string;
      requestKey: string;
      mode: "initial" | "refresh";
    }
  | { type: "loaded"; requestKey: string; accounts: WalletAssetAccount[] }
  | {
      type: "failed";
      requestKey: string;
      mode: "initial" | "refresh";
      retainSnapshot: boolean;
    }
  | { type: "settled"; requestKey: string };

export function homeWalletBalanceReducer(
  state: HomeWalletBalanceState,
  action: HomeWalletBalanceAction,
): HomeWalletBalanceState {
  switch (action.type) {
    case "reset":
      return {
        ...initialHomeWalletBalanceState,
        scopeKey: action.scopeKey,
        loading: action.scopeKey !== null,
      };
    case "begin":
      return {
        ...state,
        scopeKey: action.scopeKey,
        requestKey: action.requestKey,
        accounts: action.mode === "refresh" ? state.accounts : [],
        loading: action.mode === "initial",
        refreshing: action.mode === "refresh",
        error: null,
        refreshError: null,
      };
    case "loaded":
      return action.requestKey === state.requestKey
        ? { ...state, accounts: action.accounts, error: null, refreshError: null }
        : state;
    case "failed":
      if (action.requestKey !== state.requestKey) return state;
      return action.mode === "refresh" && action.retainSnapshot
        ? { ...state, refreshError: "Wallet balance refresh failed" }
        : {
            ...state,
            accounts: [],
            error: "Wallet balances are unavailable",
            refreshError: null,
          };
    case "settled":
      return action.requestKey === state.requestKey
        ? { ...state, loading: false, refreshing: false }
        : state;
  }
}
