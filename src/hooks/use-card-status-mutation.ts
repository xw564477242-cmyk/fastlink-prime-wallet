import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type CardStatusMutationAction,
  type WalletCard,
} from "@/lib/backend-api";
import {
  acceptsCardStatusMutationCompletion,
  beginCardStatusMutation,
  cardStatusMutationReducer,
  cardStatusMutationScopeKey,
  cardStatusMutationView,
  createCardStatusMutationGate,
  initialCardStatusMutationState,
  settleCardStatusMutation,
  syncCardStatusMutationScope,
} from "@/lib/card-status-mutation-state";

const SAFE_STATUS_ERROR = "Card status update failed. Try again.";

export function useCardStatusMutation(
  session: BackendSession | null,
  card: WalletCard | undefined,
  action: CardStatusMutationAction,
  onUpdated: (card: WalletCard) => void,
) {
  const scopeKey = cardStatusMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    action,
  );
  const [state, dispatch] = useReducer(cardStatusMutationReducer, initialCardStatusMutationState);
  const gate = useRef(createCardStatusMutationGate(scopeKey));
  syncCardStatusMutationScope(gate.current, scopeKey);
  const view = cardStatusMutationView(state, scopeKey);

  useEffect(() => {
    const currentGate = gate.current;
    dispatch({ type: "reset", scopeKey });
    return () => {
      if (currentGate.scopeKey === scopeKey) syncCardStatusMutationScope(currentGate, null);
    };
  }, [scopeKey]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !card) return false;
    let ticket;
    try {
      ticket = beginCardStatusMutation(gate.current, scopeKey, action);
    } catch {
      return false;
    }
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });
    try {
      const updated = await backendApi.updateCardStatus(card, action, ticket.idempotencyKey);
      if (!acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey)) return false;
      onUpdated(updated);
      return true;
    } catch {
      if (acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey)) {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_STATUS_ERROR });
      }
      return false;
    } finally {
      if (settleCardStatusMutation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [action, card, onUpdated, scopeKey]);

  return { ...view, allowed: scopeKey !== null, submit };
}
