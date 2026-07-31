import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type CardReplacementReason,
  type WalletCard,
} from "@/lib/backend-api";
import {
  acceptsCardReplaceCompletion,
  beginCardReplace,
  cardReplaceReducer,
  cardReplaceScopeKey,
  cardReplaceView,
  createCardReplaceGate,
  initialCardReplaceState,
  settleCardReplace,
  syncCardReplaceScope,
} from "@/lib/card-replace-state";

const SAFE_REPLACE_ERROR = "Card replacement failed. Try again.";

export function useCardReplace(
  session: BackendSession | null,
  card: WalletCard | undefined,
  reason: CardReplacementReason,
  onReplaced: (oldCardId: string, replacement: WalletCard) => void,
) {
  const scopeKey = cardReplaceScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    reason,
  );
  const [state, dispatch] = useReducer(cardReplaceReducer, initialCardReplaceState);
  const gate = useRef(createCardReplaceGate(scopeKey));
  syncCardReplaceScope(gate.current, scopeKey);
  const view = cardReplaceView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !card) return false;
    const ticket = beginCardReplace(gate.current, scopeKey, reason);
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const replacement = await backendApi.replaceCard(card, ticket.reason, ticket.idempotencyKey);
      if (!acceptsCardReplaceCompletion(gate.current, ticket, scopeKey)) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card: replacement });
      onReplaced(card.cardId, replacement);
      return true;
    } catch {
      if (acceptsCardReplaceCompletion(gate.current, ticket, scopeKey)) {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_REPLACE_ERROR });
      }
      return false;
    } finally {
      if (settleCardReplace(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [card, onReplaced, reason, scopeKey]);

  return { ...view, allowed: scopeKey !== null, submit };
}
