import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type WalletCard,
  type WalletCardLimits,
} from "@/lib/backend-api";
import {
  acceptsCardLimitsMutationCompletion,
  beginCardLimitsMutation,
  cardLimitsMutationReducer,
  cardLimitsMutationScopeKey,
  cardLimitsMutationView,
  createCardLimitsMutationGate,
  initialCardLimitsMutationState,
  settleCardLimitsMutation,
  syncCardLimitsMutationScope,
} from "@/lib/card-limits-mutation-state";

const SAFE_LIMITS_UPDATE_ERROR = "Card limits update failed. Check the values and try again.";

export function useCardLimitsMutation(
  session: BackendSession | null,
  card: WalletCard | undefined,
  current: WalletCardLimits | null,
  onUpdated: (limits: WalletCardLimits) => void,
) {
  const scopeKey = cardLimitsMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    current,
  );
  const [state, dispatch] = useReducer(cardLimitsMutationReducer, initialCardLimitsMutationState);
  const gate = useRef(createCardLimitsMutationGate(scopeKey));
  syncCardLimitsMutationScope(gate.current, scopeKey);
  const view = cardLimitsMutationView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(
    async (input: unknown): Promise<boolean> => {
      if (!scopeKey || !card || !current) return false;
      let ticket;
      try {
        ticket = beginCardLimitsMutation(gate.current, scopeKey, current, input);
      } catch {
        dispatch({ type: "rejected", scopeKey, message: SAFE_LIMITS_UPDATE_ERROR });
        return false;
      }
      if (!ticket) return false;
      dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

      try {
        const updated = await backendApi.updateCardLimits(
          card,
          current,
          ticket.input,
          ticket.idempotencyKey,
        );
        if (!acceptsCardLimitsMutationCompletion(gate.current, ticket, scopeKey)) return false;
        dispatch({ type: "succeeded", requestKey: ticket.requestKey, limits: updated });
        onUpdated(updated);
        return true;
      } catch {
        if (acceptsCardLimitsMutationCompletion(gate.current, ticket, scopeKey)) {
          dispatch({
            type: "failed",
            requestKey: ticket.requestKey,
            message: SAFE_LIMITS_UPDATE_ERROR,
          });
        }
        return false;
      } finally {
        if (settleCardLimitsMutation(gate.current, ticket, scopeKey)) {
          dispatch({ type: "settled", requestKey: ticket.requestKey });
        }
      }
    },
    [card, current, onUpdated, scopeKey],
  );

  return { ...view, allowed: scopeKey !== null, submit };
}
