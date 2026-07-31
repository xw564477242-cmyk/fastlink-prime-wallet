import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type WalletCard,
} from "@/lib/backend-api";
import {
  acceptsCardRenewCompletion,
  beginCardRenew,
  cardRenewReducer,
  cardRenewScopeKey,
  cardRenewView,
  createCardRenewGate,
  initialCardRenewState,
  settleCardRenew,
  syncCardRenewScope,
} from "@/lib/card-renew-state";

const SAFE_RENEW_ERROR = "Card renewal failed. Try again.";

export function useCardRenew(
  session: BackendSession | null,
  card: WalletCard | undefined,
  onRenewed: (card: WalletCard) => void,
) {
  const scopeKey = cardRenewScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
  );
  const [state, dispatch] = useReducer(cardRenewReducer, initialCardRenewState);
  const gate = useRef(createCardRenewGate(scopeKey));
  syncCardRenewScope(gate.current, scopeKey);
  const view = cardRenewView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !card) return false;
    const ticket = beginCardRenew(gate.current, scopeKey);
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const renewed = await backendApi.renewCard(card, ticket.idempotencyKey);
      if (!acceptsCardRenewCompletion(gate.current, ticket, scopeKey)) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card: renewed });
      onRenewed(renewed);
      return true;
    } catch {
      if (acceptsCardRenewCompletion(gate.current, ticket, scopeKey)) {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_RENEW_ERROR });
      }
      return false;
    } finally {
      if (settleCardRenew(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [card, onRenewed, scopeKey]);

  return { ...view, allowed: scopeKey !== null, submit };
}
