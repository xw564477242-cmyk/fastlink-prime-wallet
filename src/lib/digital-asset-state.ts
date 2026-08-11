import type { WalletOwnedAccountTransaction, WalletTransferAccount } from "./backend-api";

export function digitalAssetTransactionCardLabel(
  transaction: Pick<WalletOwnedAccountTransaction, "cardId" | "cardType">,
): string {
  if (!transaction.cardId || !transaction.cardType) return "No card association";
  return `${transaction.cardType === "virtual" ? "Virtual" : "Physical"} card · ${transaction.cardId}`;
}

export type DigitalAssetState = {
  scopeKey: string | null;
  requestKey: string | null;
  accounts: WalletTransferAccount[];
  selectedAccountId: string | null;
  snapshotVersion: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
};

export const initialDigitalAssetState: DigitalAssetState = {
  scopeKey: null,
  requestKey: null,
  accounts: [],
  selectedAccountId: null,
  snapshotVersion: null,
  loading: false,
  refreshing: false,
  error: null,
  refreshError: null,
};

export function digitalAssetView(
  state: DigitalAssetState,
  scopeKey: string | null,
): DigitalAssetState {
  return state.scopeKey === scopeKey
    ? state
    : {
        ...initialDigitalAssetState,
        scopeKey,
        loading: scopeKey !== null,
      };
}

export type DigitalAssetAction =
  | {
      type: "reset";
      scopeKey: string | null;
      requestKey: string | null;
      preserveSnapshot: boolean;
    }
  | {
      type: "loaded";
      requestKey: string;
      accounts: WalletTransferAccount[];
      snapshotVersion: string;
    }
  | { type: "failed"; requestKey: string; preserveSnapshot: boolean }
  | { type: "settled"; requestKey: string }
  | { type: "select"; scopeKey: string | null; accountId: string };

export function digitalAssetReducer(
  state: DigitalAssetState,
  action: DigitalAssetAction,
): DigitalAssetState {
  switch (action.type) {
    case "reset": {
      const preserve = action.preserveSnapshot && action.scopeKey === state.scopeKey;
      return {
        scopeKey: action.scopeKey,
        requestKey: action.requestKey,
        accounts: preserve ? state.accounts : [],
        selectedAccountId: preserve ? state.selectedAccountId : null,
        snapshotVersion: preserve ? state.snapshotVersion : null,
        loading: action.scopeKey !== null && !preserve,
        refreshing: action.scopeKey !== null && preserve,
        error: null,
        refreshError: null,
      };
    }
    case "loaded": {
      if (action.requestKey !== state.requestKey) return state;
      const selectedAccountId = action.accounts.some(
        (account) => account.id === state.selectedAccountId,
      )
        ? state.selectedAccountId
        : (action.accounts[0]?.id ?? null);
      return {
        ...state,
        accounts: action.accounts,
        selectedAccountId,
        snapshotVersion: action.snapshotVersion,
        error: null,
        refreshError: null,
      };
    }
    case "failed":
      if (action.requestKey !== state.requestKey) return state;
      return action.preserveSnapshot
        ? { ...state, refreshError: "Digital asset refresh failed" }
        : {
            ...state,
            accounts: [],
            selectedAccountId: null,
            snapshotVersion: null,
            error: "Digital assets are unavailable",
          };
    case "settled":
      return action.requestKey === state.requestKey
        ? { ...state, loading: false, refreshing: false }
        : state;
    case "select":
      return action.scopeKey === state.scopeKey &&
        state.accounts.some((account) => account.id === action.accountId)
        ? { ...state, selectedAccountId: action.accountId }
        : state;
  }
}
