import { useCallback, useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession, type WalletCard } from "@/lib/backend-api";
import {
  acceptsCardActivationCompletion,
  beginCardActivation,
  blockCardActivation,
  cardActivationFailureIsAmbiguous,
  cardActivationFailureIsExplicit401,
  cardActivationReducer,
  cardActivationView,
  clearCardActivationRetry,
  createCardActivationGate,
  currentCardActivationScopeKey,
  initialCardActivationState,
  invalidateCardActivationGate,
  retainCardActivationRetry,
  settleCardActivation,
  syncCardActivationScope,
} from "@/lib/card-activation-state";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

const SAFE_ACTIVATION_ERROR = "Card activation failed. Refresh the Card and try again.";
const SAFE_ACTIVATION_AMBIGUOUS_ERROR =
  "Card activation result is uncertain. Retry once to reuse the same request key.";
const SAFE_ACTIVATION_CONFLICT_ERROR =
  "Card activation could not be confirmed. Refresh this Card before another activation attempt.";

export function useCardActivation(
  session: BackendSession | null,
  card: WalletCard | undefined,
  onActivated: (card: WalletCard) => void,
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
  const scopeKey = currentCardActivationScopeKey(
    session,
    card,
    sessionIdentity.current.generation,
    cardIdentity.current.generation,
  );
  const [state, dispatch] = useReducer(cardActivationReducer, initialCardActivationState);
  const gate = useRef(createCardActivationGate(scopeKey));
  const activeAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  if (syncCardActivationScope(gate.current, scopeKey)) {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }
  const view = cardActivationView(state, scopeKey);

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
      invalidateCardActivationGate(currentGate);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !session || !card) return false;
    let ticket;
    try {
      ticket = beginCardActivation(gate.current, scopeKey);
    } catch {
      return false;
    }
    if (!ticket) return false;
    const controller = new AbortController();
    activeAbort.current = controller;
    let activationPostSucceeded = false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });
    try {
      await backendApi.activateCard(session, card, ticket.idempotencyKey, controller.signal);
      activationPostSucceeded = true;
      if (!mounted.current || !acceptsCardActivationCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      const confirmed = await backendApi.activatedCardSnapshot(session, card, controller.signal);
      if (!mounted.current || !acceptsCardActivationCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      clearCardActivationRetry(gate.current);
      onActivated(confirmed);
      return true;
    } catch (reason) {
      const current =
        mounted.current && acceptsCardActivationCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      if (cardActivationFailureIsExplicit401(reason)) {
        clearCardActivationRetry(gate.current);
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_ACTIVATION_ERROR });
        invalidateSession?.(session, "EXPLICIT_401");
      } else if (activationPostSucceeded && blockCardActivation(gate.current, ticket, scopeKey)) {
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_ACTIVATION_CONFLICT_ERROR,
        });
      } else if (
        cardActivationFailureIsAmbiguous(reason) &&
        retainCardActivationRetry(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "retryable",
          requestKey: ticket.requestKey,
          message: SAFE_ACTIVATION_AMBIGUOUS_ERROR,
        });
      } else if (
        ticket.retry &&
        cardActivationFailureIsAmbiguous(reason) &&
        blockCardActivation(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_ACTIVATION_CONFLICT_ERROR,
        });
      } else {
        clearCardActivationRetry(gate.current);
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_ACTIVATION_ERROR });
      }
      return false;
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null;
      if (mounted.current && settleCardActivation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [card, invalidateSession, onActivated, scopeKey, session]);

  return {
    ...view,
    allowed: scopeKey !== null,
    canSubmit: scopeKey !== null && !view.conflictPending,
    submit,
  };
}
