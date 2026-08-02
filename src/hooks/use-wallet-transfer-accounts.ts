import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  backendApi,
  BackendApiError,
  backendRuntime,
  walletTransferAccountReadAllowed,
  type BackendSession,
} from "@/lib/backend-api";
import {
  initialWalletTransferAccountState,
  walletTransferAccountReducer,
  walletTransferAccountScopeKey,
  walletTransferAccountView,
} from "@/lib/wallet-transfer-account-state";

type WalletTransferAccountRequestInput = {
  scopeKey: string;
  session: BackendSession;
};

type ActiveWalletTransferAccountRequest = {
  controller: AbortController;
  input: WalletTransferAccountRequestInput;
  requestKey: string;
};

export function useWalletTransferAccounts(session: BackendSession | null) {
  const [state, dispatch] = useReducer(
    walletTransferAccountReducer,
    initialWalletTransferAccountState,
  );
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const activeRequestRef = useRef<ActiveWalletTransferAccountRequest | null>(null);
  const sessionIdentityRef = useRef({ session, generation: 0 });
  if (sessionIdentityRef.current.session !== session) {
    sessionIdentityRef.current = {
      session,
      generation: sessionIdentityRef.current.generation + 1,
    };
  }
  const scopeKey = walletTransferAccountScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    Date.now(),
    sessionIdentityRef.current.generation,
  );
  const currentInputRef = useRef<WalletTransferAccountRequestInput | null>(null);
  currentInputRef.current = scopeKey && session ? { scopeKey, session } : null;
  const view = walletTransferAccountView(state, scopeKey);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
      sequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    const generation = ++sequenceRef.current;
    const requestKey = scopeKey ? JSON.stringify([scopeKey, refreshGeneration, generation]) : null;
    dispatch({
      type: "reset",
      scopeKey,
      requestKey,
      preserveSnapshot: refreshGeneration > 0,
    });
    if (!requestKey || !session || !scopeKey) return;

    const controller = new AbortController();
    const input = { scopeKey, session };
    const activeRequest = { controller, input, requestKey };
    activeRequestRef.current = activeRequest;

    const isCurrent = () =>
      mountedRef.current &&
      activeRequestRef.current === activeRequest &&
      currentInputRef.current?.session === input.session &&
      currentInputRef.current.scopeKey === input.scopeKey &&
      walletTransferAccountReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );

    void backendApi
      .walletTransferAccounts(session, controller.signal)
      .then((accounts) => {
        if (isCurrent()) dispatch({ type: "loaded", requestKey, accounts });
      })
      .catch((reason: unknown) => {
        if (!isCurrent()) return;
        const mayPreserveSnapshot =
          reason instanceof BackendApiError &&
          (reason.status === 0 ||
            reason.status === 408 ||
            (reason.status >= 500 && reason.status <= 599));
        const clearSnapshot = !mayPreserveSnapshot;
        dispatch({ type: "failed", requestKey, clearSnapshot });
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeRequestRef.current = null;
        dispatch({ type: "settled", requestKey });
      });

    return () => {
      if (activeRequestRef.current === activeRequest) activeRequestRef.current = null;
      controller.abort();
      sequenceRef.current += 1;
    };
  }, [refreshGeneration, scopeKey, session]);

  const refresh = useCallback(() => {
    if (!currentInputRef.current || activeRequestRef.current) return;
    setRefreshGeneration((value) => value + 1);
  }, []);

  return { ...view, refresh };
}
