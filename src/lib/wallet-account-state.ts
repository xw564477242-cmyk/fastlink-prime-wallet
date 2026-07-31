import type { BackendSession, WalletAssetAccount } from "./backend-api";

export type WalletAccountRequestIdentity = Readonly<{
  sessionKey: string | null;
  requestId: number;
  accountsVersion: string;
}>;

export type WalletAccountState = {
  sessionKey: string | null;
  requestId: number;
  requestAccountsVersion: string;
  accountsVersion: string;
  accounts: WalletAssetAccount[];
  selectedAssetCode: string | null;
  loading: boolean;
  error: string | null;
};

export function walletBalanceSessionKey(session: BackendSession | null): string | null {
  return session
    ? JSON.stringify([
        session.actorId,
        session.expiresAt ?? null,
        session.tenantId,
        session.customerId,
        session.environment,
      ])
    : null;
}

export function captureWalletBalanceAccountsVersion(
  accounts: readonly WalletAssetAccount[],
): string {
  return JSON.stringify(
    accounts.map((account) => [
      account.assetCode,
      account.availableBalance,
      account.ledgerBalance,
      account.pendingBalance,
      account.updatedAt,
    ]),
  );
}

const emptyAccountsVersion = captureWalletBalanceAccountsVersion([]);

export const initialWalletAccountState: WalletAccountState = {
  sessionKey: null,
  requestId: 0,
  requestAccountsVersion: emptyAccountsVersion,
  accountsVersion: emptyAccountsVersion,
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

export function walletAccountRequestIsCurrent(
  state: WalletAccountState,
  identity: WalletAccountRequestIdentity,
): boolean {
  return (
    identity.requestId === state.requestId &&
    identity.sessionKey === state.sessionKey &&
    identity.accountsVersion === state.requestAccountsVersion
  );
}

export type WalletAccountAction =
  | { type: "reset"; identity: WalletAccountRequestIdentity; loading: boolean }
  | {
      type: "loaded";
      identity: WalletAccountRequestIdentity;
      accounts: WalletAssetAccount[];
      accountsVersion: string;
    }
  | { type: "failed"; identity: WalletAccountRequestIdentity; message: string }
  | { type: "settled"; identity: WalletAccountRequestIdentity }
  | { type: "select"; sessionKey: string | null; assetCode: string };

export function walletAccountReducer(
  state: WalletAccountState,
  action: WalletAccountAction,
): WalletAccountState {
  switch (action.type) {
    case "reset":
      return {
        sessionKey: action.identity.sessionKey,
        requestId: action.identity.requestId,
        requestAccountsVersion: action.identity.accountsVersion,
        accountsVersion: emptyAccountsVersion,
        accounts: [],
        selectedAssetCode: null,
        loading: action.loading,
        error: null,
      };
    case "loaded":
      if (
        !walletAccountRequestIsCurrent(state, action.identity) ||
        action.accountsVersion !== captureWalletBalanceAccountsVersion(action.accounts)
      ) {
        return state;
      }
      return {
        ...state,
        accountsVersion: action.accountsVersion,
        accounts: action.accounts,
        selectedAssetCode: action.accounts[0]?.assetCode ?? null,
        error: null,
      };
    case "failed":
      if (!walletAccountRequestIsCurrent(state, action.identity)) return state;
      return {
        ...state,
        accountsVersion: emptyAccountsVersion,
        accounts: [],
        selectedAssetCode: null,
        error: action.message,
      };
    case "settled":
      return walletAccountRequestIsCurrent(state, action.identity)
        ? { ...state, loading: false }
        : state;
    case "select":
      return action.sessionKey === state.sessionKey &&
        state.accounts.some((account) => account.assetCode === action.assetCode)
        ? { ...state, selectedAssetCode: action.assetCode }
        : state;
  }
}
