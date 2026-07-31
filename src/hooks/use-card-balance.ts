import { useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardBalanceErrorMessage,
  cardBalanceReducer,
  cardBalanceRequestKey,
  cardBalanceViewForScope,
  initialCardBalanceState,
} from "@/lib/card-balance-state";

export function useCardBalance(session: BackendSession | null, cardId: string | null) {
  const [state, dispatch] = useReducer(cardBalanceReducer, initialCardBalanceState);
  const requestSequence = useRef(0);
  const scopeKey =
    session && cardId
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.environment,
          cardId,
        ])
      : null;
  const view = cardBalanceViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardBalanceRequestKey(scopeKey, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!cardId || !requestKey) return;

    void backendApi
      .cardBalance(cardId)
      .then((balance) => dispatch({ type: "loaded", requestKey, balance }))
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestKey,
          message: cardBalanceErrorMessage(reason),
        }),
      )
      .finally(() => dispatch({ type: "settled", requestKey }));

    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [cardId, scopeKey]);

  return view;
}
