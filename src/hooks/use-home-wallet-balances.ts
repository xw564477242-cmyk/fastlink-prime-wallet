import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  BackendApiError,
  backendRuntime,
  type BackendSession,
} from "@/lib/backend-api";
import {
  homeWalletBalanceReadAllowed,
  homeWalletBalanceReducer,
  homeWalletBalanceScopeKey,
  homeWalletBalanceView,
  initialHomeWalletBalanceState,
} from "@/lib/home-wallet-balance-state";

type WalletBalanceRequestInput = {
  scopeKey: string;
  session: BackendSession;
};

type ActiveWalletBalanceRequest = {
  controller: AbortController;
  input: WalletBalanceRequestInput;
  requestKey: string;
};

export function useHomeWalletBalances(session: BackendSession | null) {
  const [state, dispatch] = useReducer(homeWalletBalanceReducer, initialHomeWalletBalanceState);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const activeRequestRef = useRef<ActiveWalletBalanceRequest | null>(null);
  const sessionIdentityRef = useRef({ session, generation: 0 });
  if (sessionIdentityRef.current.session !== session) {
    sessionIdentityRef.current = {
      session,
      generation: sessionIdentityRef.current.generation + 1,
    };
  }
  const scopeKey = homeWalletBalanceScopeKey(
    session,
    backendRuntime.environment,
    backendRuntime.apiUrl,
    Date.now(),
    sessionIdentityRef.current.generation,
  );
  const currentInputRef = useRef<WalletBalanceRequestInput | null>(null);
  currentInputRef.current = scopeKey && session ? { scopeKey, session } : null;
  const view = homeWalletBalanceView(state, scopeKey);

  const startRead = useCallback((input: WalletBalanceRequestInput, mode: "initial" | "refresh") => {
    if (activeRequestRef.current || !mountedRef.current) return;
    const controller = new AbortController();
    const requestKey = JSON.stringify([input.scopeKey, ++sequenceRef.current, mode]);
    const activeRequest = { controller, input, requestKey };
    activeRequestRef.current = activeRequest;
    dispatch({ type: "begin", scopeKey: input.scopeKey, requestKey, mode });

    const isCurrent = () =>
      mountedRef.current &&
      activeRequestRef.current === activeRequest &&
      currentInputRef.current?.session === input.session &&
      currentInputRef.current.scopeKey === input.scopeKey &&
      homeWalletBalanceReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );

    void backendApi
      .walletBalanceAccounts(input.session.environment, controller.signal)
      .then((accounts) => {
        if (isCurrent()) dispatch({ type: "loaded", requestKey, accounts });
      })
      .catch((reason: unknown) => {
        if (!isCurrent()) return;
        const transient =
          reason instanceof BackendApiError &&
          (reason.status === 0 ||
            reason.status === 408 ||
            (reason.status >= 500 && reason.status <= 599));
        dispatch({
          type: "failed",
          requestKey,
          mode,
          retainSnapshot: mode === "refresh" && transient,
        });
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeRequestRef.current = null;
        dispatch({ type: "settled", requestKey });
      });
  }, []);

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
    sequenceRef.current += 1;
    dispatch({ type: "reset", scopeKey });
    const input = currentInputRef.current;
    if (input) startRead(input, "initial");
    return () => {
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
      sequenceRef.current += 1;
    };
  }, [scopeKey, session, startRead]);

  const refresh = useCallback(() => {
    const input = currentInputRef.current;
    if (!input || activeRequestRef.current) return;
    startRead(input, "refresh");
  }, [startRead]);

  return {
    ...view,
    refresh,
    canRefresh:
      scopeKey !== null &&
      view.scopeReady &&
      !view.loading &&
      !view.refreshing &&
      view.error === null,
  };
}
