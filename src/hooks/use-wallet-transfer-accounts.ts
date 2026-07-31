import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { backendApi, type BackendSession, type WalletTransferAccount } from "@/lib/backend-api";

type State = {
  scopeKey: string | null;
  requestKey: string | null;
  accounts: WalletTransferAccount[];
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null }
  | { type: "loaded"; requestKey: string; accounts: WalletTransferAccount[] }
  | { type: "failed"; requestKey: string }
  | { type: "settled"; requestKey: string };

const initialState: State = {
  scopeKey: null,
  requestKey: null,
  accounts: [],
  loading: false,
  error: null,
};

function reducer(state: State, action: Action): State {
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

export function useWalletTransferAccounts(session: BackendSession | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const sequence = useRef(0);
  const scopeKey = session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;
  const view =
    state.scopeKey === scopeKey ? state : { ...initialState, scopeKey, loading: scopeKey !== null };

  useEffect(() => {
    const generation = ++sequence.current;
    const requestKey = scopeKey ? JSON.stringify([scopeKey, refreshGeneration, generation]) : null;
    dispatch({ type: "reset", scopeKey, requestKey });
    if (!requestKey) return;
    void backendApi
      .walletTransferAccounts()
      .then((accounts) => dispatch({ type: "loaded", requestKey, accounts }))
      .catch(() => dispatch({ type: "failed", requestKey }))
      .finally(() => dispatch({ type: "settled", requestKey }));
    return () => {
      if (sequence.current === generation) sequence.current += 1;
    };
  }, [refreshGeneration, scopeKey]);

  const refresh = useCallback(() => setRefreshGeneration((value) => value + 1), []);
  return { ...view, refresh };
}
