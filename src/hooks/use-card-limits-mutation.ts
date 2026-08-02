import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  normalizeCardLimitsUpdateInput,
  type BackendSession,
  type WalletCard,
  type WalletCardLimits,
} from "@/lib/backend-api";
import {
  acceptsCardLimitsMutationCompletion,
  beginCardLimitsMutation,
  blockCardLimitsMutation,
  cardLimitsMutationFailureIsAmbiguous,
  cardLimitsMutationFailureIsExplicit401,
  cardLimitsMutationRecoveryState,
  cardLimitsMutationReducer,
  cardLimitsMutationScopeKey,
  cardLimitsMutationView,
  clearCardLimitsMutationRetry,
  createCardLimitsMutationGate,
  invalidateCardLimitsMutationGate,
  initialCardLimitsMutationState,
  retainCardLimitsMutationRetry,
  settleCardLimitsMutation,
  syncCardLimitsMutationScope,
} from "@/lib/card-limits-mutation-state";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

const SAFE_LIMITS_UPDATE_ERROR = "Card limits update failed. Check the values and try again.";
const SAFE_LIMITS_UPDATE_AMBIGUOUS_ERROR =
  "Card limits result is uncertain. Retry once to reuse the same request key.";
const SAFE_LIMITS_UPDATE_CONFLICT_ERROR =
  "Card limits could not be confirmed. Refresh this Card before another limits update.";

export function useCardLimitsMutation(
  session: BackendSession | null,
  card: WalletCard | undefined,
  current: WalletCardLimits | null,
  input: unknown,
  onUpdated: (limits: WalletCardLimits) => void,
  invalidateSession?: BackendSessionInvalidator,
) {
  const identities = useRef({ next: 1, values: new WeakMap<object, number>() });
  const identityOf = (value: unknown): number => {
    if ((typeof value !== "object" || value === null) && typeof value !== "function") return 0;
    const object = value as object;
    const existing = identities.current.values.get(object);
    if (existing) return existing;
    const created = identities.current.next++;
    identities.current.values.set(object, created);
    return created;
  };
  const recoveryScopeKey = cardLimitsMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    current,
    identityOf(session),
    identityOf(card),
    identityOf(current),
  );
  let inputScopeKey = "INVALID";
  if (current) {
    try {
      inputScopeKey = JSON.stringify(normalizeCardLimitsUpdateInput(input, current));
    } catch {
      inputScopeKey = "INVALID";
    }
  }
  const scopeKey = recoveryScopeKey
    ? JSON.stringify([recoveryScopeKey, identityOf(input), inputScopeKey])
    : null;
  const [state, dispatch] = useReducer(cardLimitsMutationReducer, initialCardLimitsMutationState);
  const gate = useRef(createCardLimitsMutationGate(scopeKey));
  const mounted = useRef(false);
  syncCardLimitsMutationScope(gate.current, scopeKey);
  const view = cardLimitsMutationView(state, scopeKey);
  const recovery = cardLimitsMutationRecoveryState(gate.current, scopeKey, recoveryScopeKey);
  const visible = {
    ...view,
    retryPending: recovery.retryPending,
    conflictPending: recovery.conflictPending,
    error:
      view.error ??
      (recovery.conflictPending && recoveryScopeKey ? SAFE_LIMITS_UPDATE_CONFLICT_ERROR : null),
  };

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  useEffect(() => {
    const currentGate = gate.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateCardLimitsMutationGate(currentGate);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !recoveryScopeKey || !card || !current || !recovery.canSubmit) return false;
    let ticket;
    try {
      ticket = beginCardLimitsMutation(
        gate.current,
        scopeKey,
        current,
        input,
        undefined,
        recoveryScopeKey,
      );
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
      if (!mounted.current || !acceptsCardLimitsMutationCompletion(gate.current, ticket, scopeKey))
        return false;
      clearCardLimitsMutationRetry(gate.current, ticket.recoveryScopeKey);
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, limits: updated });
      onUpdated(updated);
      return true;
    } catch (reason) {
      const currentTicket =
        mounted.current && acceptsCardLimitsMutationCompletion(gate.current, ticket, scopeKey);
      if (!currentTicket) return false;
      if (cardLimitsMutationFailureIsExplicit401(reason)) {
        clearCardLimitsMutationRetry(gate.current, ticket.recoveryScopeKey);
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_LIMITS_UPDATE_ERROR,
        });
        if (session) invalidateSession?.(session, "EXPLICIT_401");
      } else if (
        cardLimitsMutationFailureIsAmbiguous(reason) &&
        retainCardLimitsMutationRetry(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "retryable",
          requestKey: ticket.requestKey,
          message: SAFE_LIMITS_UPDATE_AMBIGUOUS_ERROR,
        });
      } else if (
        ticket.retry &&
        cardLimitsMutationFailureIsAmbiguous(reason) &&
        blockCardLimitsMutation(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_LIMITS_UPDATE_CONFLICT_ERROR,
        });
      } else {
        clearCardLimitsMutationRetry(gate.current, ticket.recoveryScopeKey);
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_LIMITS_UPDATE_ERROR,
        });
      }
      return false;
    } finally {
      if (mounted.current && settleCardLimitsMutation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [
    card,
    current,
    input,
    invalidateSession,
    onUpdated,
    recovery.canSubmit,
    recoveryScopeKey,
    scopeKey,
    session,
  ]);

  return {
    ...visible,
    allowed: recoveryScopeKey !== null,
    canSubmit: recoveryScopeKey !== null && recovery.canSubmit,
    submit,
  };
}
