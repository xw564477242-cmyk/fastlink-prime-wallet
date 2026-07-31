import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { backendApi, backendRuntime, type BackendSession } from "@/lib/backend-api";
import {
  initialWalletTransferAccountState,
  walletTransferAccountReducer,
  walletTransferAccountScopeKey,
  walletTransferAccountView,
} from "@/lib/wallet-transfer-account-state";

export function useWalletTransferAccounts(session: BackendSession | null) {
  const [state, dispatch] = useReducer(
    walletTransferAccountReducer,
    initialWalletTransferAccountState,
  );
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const sequence = useRef(0);
  const scopeKey = walletTransferAccountScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
  );
  const view = walletTransferAccountView(state, scopeKey);

  useEffect(() => {
    const generation = ++sequence.current;
    const requestKey = scopeKey ? JSON.stringify([scopeKey, refreshGeneration, generation]) : null;
    dispatch({ type: "reset", scopeKey, requestKey });
    if (!requestKey || !session) return;
    void backendApi
      .walletTransferAccounts(session)
      .then((accounts) => dispatch({ type: "loaded", requestKey, accounts }))
      .catch(() => dispatch({ type: "failed", requestKey }))
      .finally(() => dispatch({ type: "settled", requestKey }));
    return () => {
      if (sequence.current === generation) sequence.current += 1;
    };
  }, [refreshGeneration, scopeKey, session]);

  const refresh = useCallback(() => setRefreshGeneration((value) => value + 1), []);
  return { ...view, refresh };
}
