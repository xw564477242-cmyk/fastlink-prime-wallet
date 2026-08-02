import { useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardBalanceErrorMessage,
  cardBalanceReducer,
  cardBalanceRequestKey,
  cardBalanceViewForScope,
  initialCardBalanceState,
} from "@/lib/card-balance-state";

export function useCardBalance(
  session: BackendSession | null,
  cardId: string | null,
  cardGeneration = 0,
) {
  const [state, dispatch] = useReducer(cardBalanceReducer, initialCardBalanceState);
  const requestSequence = useRef(0);
  const sessionIdentity = useRef({ session, generation: 0 });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const scopeKey =
    session && cardId
      ? JSON.stringify([
          session.actorId,
          session.expiresAt ?? null,
          session.tenantId,
          session.customerId,
          session.environment,
          sessionIdentity.current.generation,
          cardId,
          cardGeneration,
        ])
      : null;
  const view = cardBalanceViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardBalanceRequestKey(scopeKey, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!cardId || !requestKey) return;
    const controller = new AbortController();

    void backendApi
      .cardBalance(cardId, controller.signal)
      .then((balance) => {
        if (!controller.signal.aborted) dispatch({ type: "loaded", requestKey, balance });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          dispatch({
            type: "failed",
            requestKey,
            message: cardBalanceErrorMessage(reason),
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) dispatch({ type: "settled", requestKey });
      });

    return () => {
      controller.abort();
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [cardId, scopeKey]);

  return view;
}
