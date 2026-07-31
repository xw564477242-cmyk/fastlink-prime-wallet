import { useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardLimitsErrorMessage,
  cardLimitsReducer,
  cardLimitsRequestKey,
  cardLimitsViewForScope,
  initialCardLimitsState,
} from "@/lib/card-limits-state";

export function useCardLimits(session: BackendSession | null, cardId: string | null) {
  const [state, dispatch] = useReducer(cardLimitsReducer, initialCardLimitsState);
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
  const view = cardLimitsViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardLimitsRequestKey(scopeKey, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!cardId || !requestKey) return;

    void backendApi
      .cardLimits(cardId)
      .then((limits) => dispatch({ type: "loaded", requestKey, limits }))
      .catch((reason) =>
        dispatch({ type: "failed", requestKey, message: cardLimitsErrorMessage(reason) }),
      )
      .finally(() => dispatch({ type: "settled", requestKey }));

    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [cardId, scopeKey]);

  return view;
}
