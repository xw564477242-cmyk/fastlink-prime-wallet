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
  blockCardReplace,
  cardReplaceReducer,
  cardReplaceScopeKey,
  cardReplaceView,
  createCardReplaceGate,
  initialCardReplaceState,
  settleCardReplace,
  syncCardReplaceScope,
} from "@/lib/card-replace-state";
import {
  backendSessionInvalidationReasonFromError,
  type BackendSessionInvalidator,
} from "@/lib/backend-session-policy";

const SAFE_REPLACE_ERROR = "Card replacement failed. Try again.";
const SAFE_REPLACE_CONFLICT_ERROR =
  "Card replacement could not be confirmed. Refresh Cards before another replacement.";

export function useCardReplace(
  session: BackendSession | null,
  card: WalletCard | undefined,
  reason: CardReplacementReason,
  onReplaced: (
    predecessor: WalletCard,
    replacement: WalletCard,
    isCurrent: () => boolean,
    signal: AbortSignal,
  ) => Promise<boolean>,
  onUnconfirmed: () => void,
  invalidateSession?: BackendSessionInvalidator,
) {
  const sessionIdentity = useRef({ session, generation: 0 });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const cardIdentity = useRef({ card, generation: 0 });
  if (cardIdentity.current.card !== card) {
    cardIdentity.current = {
      card,
      generation: cardIdentity.current.generation + 1,
    };
  }
  const scopeKey = cardReplaceScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    reason,
    sessionIdentity.current.generation,
    cardIdentity.current.generation,
    backendRuntime.error === null ? backendRuntime.apiUrl : "",
  );
  const [state, dispatch] = useReducer(cardReplaceReducer, initialCardReplaceState);
  const gate = useRef(createCardReplaceGate(scopeKey));
  const activeAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const previousScope = gate.current.scopeKey;
  syncCardReplaceScope(gate.current, scopeKey);
  if (previousScope !== scopeKey) {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }
  const view = cardReplaceView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  useEffect(() => {
    const currentGate = gate.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeAbort.current?.abort();
      activeAbort.current = null;
      syncCardReplaceScope(currentGate, null);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !session || !card) return false;
    const ticket = beginCardReplace(gate.current, scopeKey, reason);
    if (!ticket) return false;
    const controller = new AbortController();
    activeAbort.current = controller;
    let replacePostSucceeded = false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const replacement = await backendApi.replaceCard(
        card,
        ticket.reason,
        ticket.idempotencyKey,
        controller.signal,
      );
      replacePostSucceeded = true;
      if (!mounted.current || !acceptsCardReplaceCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      const isCurrent = () =>
        mounted.current && acceptsCardReplaceCompletion(gate.current, ticket, scopeKey);
      if (!(await onReplaced(card, replacement, isCurrent, controller.signal))) {
        throw new Error("Replacement Card was not confirmed by the bounded Card list");
      }
      if (!isCurrent()) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card: replacement });
      return true;
    } catch (error) {
      const current =
        mounted.current && acceptsCardReplaceCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      const invalidationReason = backendSessionInvalidationReasonFromError(error);
      if (invalidationReason) {
        if (replacePostSucceeded) onUnconfirmed();
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_REPLACE_ERROR });
        invalidateSession?.(session, invalidationReason);
      } else if (replacePostSucceeded && blockCardReplace(gate.current, ticket, scopeKey)) {
        onUnconfirmed();
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_REPLACE_CONFLICT_ERROR,
        });
      } else {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_REPLACE_ERROR });
      }
      return false;
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null;
      if (mounted.current && settleCardReplace(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [card, invalidateSession, onReplaced, onUnconfirmed, reason, scopeKey, session]);

  return {
    ...view,
    allowed: scopeKey !== null,
    canSubmit: scopeKey !== null && !view.conflictPending,
    submit,
  };
}
