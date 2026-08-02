import { useCallback, useEffect, useReducer, useRef } from "react";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import {
  fetchKycStatus,
  initialKycStatusState,
  kycStatusErrorMessage,
  kycStatusReducer,
  kycStatusRequestKey,
  kycStatusScopeKey,
  kycStatusSessionReadAllowed,
  kycStatusViewForScope,
  type KycStatusRuntime,
} from "@/lib/kyc-status-state";

type KycStatusInput = {
  scopeKey: string;
  session: BackendSession;
  runtime: KycStatusRuntime;
};

type ActiveKycStatusRequest = {
  controller: AbortController;
  requestKey: string;
};

export function useKycStatus(
  session: BackendSession | null,
  runtime: KycStatusRuntime = backendRuntime,
) {
  const [state, dispatch] = useReducer(kycStatusReducer, initialKycStatusState);
  const generationRef = useRef(0);
  const activeRequestRef = useRef<ActiveKycStatusRequest | null>(null);
  const scopeKey = kycStatusScopeKey(session, runtime);
  const inputRef = useRef<KycStatusInput | null>(null);
  inputRef.current = scopeKey && session ? { scopeKey, session, runtime } : null;
  const view = kycStatusViewForScope(state, scopeKey);

  const refresh = useCallback(() => {
    const input = inputRef.current;
    if (!input || !kycStatusSessionReadAllowed(input.session, input.runtime)) return;

    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestKey = kycStatusRequestKey(input.scopeKey, ++generationRef.current);
    activeRequestRef.current = { controller, requestKey };
    dispatch({ type: "begin", scopeKey: input.scopeKey, requestKey });

    const isCurrent = () =>
      activeRequestRef.current?.controller === controller &&
      activeRequestRef.current.requestKey === requestKey &&
      inputRef.current?.scopeKey === input.scopeKey &&
      kycStatusSessionReadAllowed(input.session, input.runtime);

    void fetchKycStatus(input.session, input.runtime, controller.signal)
      .then((snapshot) => {
        if (isCurrent()) dispatch({ type: "loaded", requestKey, snapshot });
      })
      .catch((reason) => {
        if (isCurrent()) {
          dispatch({ type: "failed", requestKey, message: kycStatusErrorMessage(reason) });
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeRequestRef.current = null;
        dispatch({ type: "settled", requestKey });
      });
  }, []);

  useEffect(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    generationRef.current += 1;
    dispatch({ type: "reset", scopeKey });
    return () => {
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
      generationRef.current += 1;
    };
  }, [scopeKey]);

  return {
    ...view,
    scopeKey,
    refresh,
    canRefresh: scopeKey !== null && view.scopeReady,
  };
}
