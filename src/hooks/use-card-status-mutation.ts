import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  CardStatusMutationConfirmationError,
  backendApi,
  backendRuntime,
  type BackendSession,
  type CardStatusMutationAction,
  type WalletCard,
} from "@/lib/backend-api";
import {
  acceptsCardStatusMutationCompletion,
  beginCardStatusMutation,
  blockCardStatusMutation,
  cardStatusMutationFailureIsAmbiguous,
  cardStatusMutationFailureIsExplicit401,
  cardStatusMutationReducer,
  cardStatusMutationScopeKey,
  cardStatusMutationView,
  clearCardStatusMutationRetry,
  createCardStatusMutationGate,
  invalidateCardStatusMutationGate,
  initialCardStatusMutationState,
  retainCardStatusMutationRetry,
  settleCardStatusMutation,
  syncCardStatusMutationScope,
} from "@/lib/card-status-mutation-state";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

const SAFE_STATUS_ERROR = "Card status update failed. Try again.";
const SAFE_STATUS_AMBIGUOUS_ERROR =
  "Card status result is uncertain. Retry once to reuse the same request key.";
const SAFE_STATUS_CONFLICT_ERROR =
  "Card status could not be confirmed. Refresh this Card before another status update.";

export function useCardStatusMutation(
  session: BackendSession | null,
  card: WalletCard | undefined,
  action: CardStatusMutationAction,
  onUpdated: (card: WalletCard, isCurrent: () => boolean, signal: AbortSignal) => Promise<boolean>,
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
  const scopeKey = cardStatusMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    action,
    sessionIdentity.current.generation,
    cardIdentity.current.generation,
    backendRuntime.error === null ? backendRuntime.apiUrl : "",
  );
  const [state, dispatch] = useReducer(cardStatusMutationReducer, initialCardStatusMutationState);
  const gate = useRef(createCardStatusMutationGate(scopeKey));
  const activeAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  if (syncCardStatusMutationScope(gate.current, scopeKey)) {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }
  const view = cardStatusMutationView(state, scopeKey);

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
      invalidateCardStatusMutationGate(currentGate);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !card) return false;
    let ticket;
    try {
      ticket = beginCardStatusMutation(gate.current, scopeKey, action);
    } catch {
      return false;
    }
    if (!ticket) return false;
    const controller = new AbortController();
    activeAbort.current = controller;
    let statusPostSucceeded = false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });
    try {
      const updated = await backendApi.updateCardStatus(
        card,
        action,
        ticket.idempotencyKey,
        controller.signal,
      );
      statusPostSucceeded = true;
      if (!mounted.current || !acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey))
        return false;
      const confirmed = await backendApi.cardStatusMutationSnapshot(
        card,
        action,
        updated,
        controller.signal,
      );
      if (!mounted.current || !acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey))
        return false;
      const isCurrent = () =>
        mounted.current && acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey);
      if (!(await onUpdated(confirmed, isCurrent, controller.signal))) {
        throw new CardStatusMutationConfirmationError();
      }
      clearCardStatusMutationRetry(gate.current);
      return true;
    } catch (reason) {
      const current =
        mounted.current && acceptsCardStatusMutationCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      if (cardStatusMutationFailureIsExplicit401(reason)) {
        clearCardStatusMutationRetry(gate.current);
        if (statusPostSucceeded) onUnconfirmed();
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_STATUS_ERROR });
        if (session) invalidateSession?.(session, "EXPLICIT_401");
      } else if (
        (statusPostSucceeded || reason instanceof CardStatusMutationConfirmationError) &&
        blockCardStatusMutation(gate.current, ticket, scopeKey)
      ) {
        onUnconfirmed();
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_STATUS_CONFLICT_ERROR,
        });
      } else if (
        cardStatusMutationFailureIsAmbiguous(reason) &&
        retainCardStatusMutationRetry(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "retryable",
          requestKey: ticket.requestKey,
          message: SAFE_STATUS_AMBIGUOUS_ERROR,
        });
      } else if (
        ticket.retry &&
        cardStatusMutationFailureIsAmbiguous(reason) &&
        blockCardStatusMutation(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_STATUS_CONFLICT_ERROR,
        });
      } else {
        clearCardStatusMutationRetry(gate.current);
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_STATUS_ERROR });
      }
      return false;
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null;
      if (mounted.current && settleCardStatusMutation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [action, card, invalidateSession, onUnconfirmed, onUpdated, scopeKey, session]);

  return {
    ...view,
    allowed: scopeKey !== null,
    canSubmit: scopeKey !== null && !view.conflictPending,
    submit,
  };
}
