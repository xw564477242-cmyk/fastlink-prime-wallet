import { useCallback, useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession, type WalletCardLimits } from "@/lib/backend-api";
import {
  cardLimitsErrorMessage,
  cardLimitsReducer,
  cardLimitsRequestKey,
  cardLimitsViewForScope,
  initialCardLimitsState,
} from "@/lib/card-limits-state";

export function useCardLimits(
  session: BackendSession | null,
  cardId: string | null,
  cardGeneration = 0,
) {
  const [state, dispatch] = useReducer(cardLimitsReducer, initialCardLimitsState);
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
  const view = cardLimitsViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardLimitsRequestKey(scopeKey, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!cardId || !requestKey) return;
    const controller = new AbortController();

    void backendApi
      .cardLimits(cardId, controller.signal)
      .then((limits) => {
        if (!controller.signal.aborted) dispatch({ type: "loaded", requestKey, limits });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "failed", requestKey, message: cardLimitsErrorMessage(reason) });
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

  const replaceCurrentLimits = useCallback(
    (limits: WalletCardLimits) => {
      if (!scopeKey || limits.cardId !== cardId) return;
      requestSequence.current += 1;
      dispatch({ type: "replace-current", scopeKey, limits });
    },
    [cardId, scopeKey],
  );

  return { ...view, replaceCurrentLimits };
}
