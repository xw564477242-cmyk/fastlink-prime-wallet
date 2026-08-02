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
  blockCardRenew,
  cardRenewReducer,
  cardRenewScopeKey,
  cardRenewView,
  createCardRenewGate,
  initialCardRenewState,
  settleCardRenew,
  syncCardRenewScope,
} from "@/lib/card-renew-state";
import {
  backendSessionInvalidationReasonFromError,
  type BackendSessionInvalidator,
} from "@/lib/backend-session-policy";

const SAFE_RENEW_ERROR = "Card renewal failed. Try again.";
const SAFE_RENEW_CONFLICT_ERROR =
  "Card renewal could not be confirmed. Refresh Cards before another renewal.";

export function useCardRenew(
  session: BackendSession | null,
  card: WalletCard | undefined,
  onRenewed: (
    predecessor: WalletCard,
    renewed: WalletCard,
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
  const scopeKey = cardRenewScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    card,
    sessionIdentity.current.generation,
    cardIdentity.current.generation,
    backendRuntime.error === null ? backendRuntime.apiUrl : "",
  );
  const [state, dispatch] = useReducer(cardRenewReducer, initialCardRenewState);
  const gate = useRef(createCardRenewGate(scopeKey));
  const activeAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const previousScope = gate.current.scopeKey;
  syncCardRenewScope(gate.current, scopeKey);
  if (previousScope !== scopeKey) {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }
  const view = cardRenewView(state, scopeKey);

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
      syncCardRenewScope(currentGate, null);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !session || !card) return false;
    const ticket = beginCardRenew(gate.current, scopeKey);
    if (!ticket) return false;
    const controller = new AbortController();
    activeAbort.current = controller;
    let renewPostSucceeded = false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const renewed = await backendApi.renewCard(card, ticket.idempotencyKey, controller.signal);
      renewPostSucceeded = true;
      if (!mounted.current || !acceptsCardRenewCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      const isCurrent = () =>
        mounted.current && acceptsCardRenewCompletion(gate.current, ticket, scopeKey);
      if (!(await onRenewed(card, renewed, isCurrent, controller.signal))) {
        throw new Error("Renewed Card was not confirmed by the bounded Card list");
      }
      if (!isCurrent()) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card: renewed });
      return true;
    } catch (error) {
      const current = mounted.current && acceptsCardRenewCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      const invalidationReason = backendSessionInvalidationReasonFromError(error);
      if (invalidationReason) {
        if (renewPostSucceeded) onUnconfirmed();
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_RENEW_ERROR });
        invalidateSession?.(session, invalidationReason);
      } else if (renewPostSucceeded && blockCardRenew(gate.current, ticket, scopeKey)) {
        onUnconfirmed();
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_RENEW_CONFLICT_ERROR,
        });
      } else {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_RENEW_ERROR });
      }
      return false;
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null;
      if (mounted.current && settleCardRenew(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [card, invalidateSession, onRenewed, onUnconfirmed, scopeKey, session]);

  return {
    ...view,
    allowed: scopeKey !== null,
    canSubmit: scopeKey !== null && !view.conflictPending,
    submit,
  };
}
