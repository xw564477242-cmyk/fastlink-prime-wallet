import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  normalizeVirtualCardCreateInput,
  type BackendSession,
  type VirtualCardCreateInput,
  type WalletCard,
} from "@/lib/backend-api";
import {
  acceptsVirtualCardCreateCompletion,
  beginVirtualCardCreate,
  blockVirtualCardCreate,
  createVirtualCardCreateGate,
  initialVirtualCardCreateState,
  settleVirtualCardCreate,
  syncVirtualCardCreateScope,
  virtualCardCreateReducer,
  virtualCardCreateScopeKey,
  virtualCardCreateView,
} from "@/lib/virtual-card-create-state";
import {
  backendSessionInvalidationReasonFromError,
  type BackendSessionInvalidator,
} from "@/lib/backend-session-policy";

const SAFE_CREATE_ERROR = "Virtual Card creation failed. Try again.";
const SAFE_CREATE_CONFLICT_ERROR =
  "Virtual Card creation could not be confirmed. Refresh Cards before creating another Card.";

export function useVirtualCardCreate(
  session: BackendSession | null,
  input: VirtualCardCreateInput,
  onCreated: (
    card: WalletCard,
    isCurrent: () => boolean,
    signal: AbortSignal,
  ) => boolean | Promise<boolean>,
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
  const inputIdentity = useRef({ input, generation: 0 });
  if (inputIdentity.current.input !== input) {
    inputIdentity.current = {
      input,
      generation: inputIdentity.current.generation + 1,
    };
  }
  let normalizedInput: VirtualCardCreateInput | null = null;
  try {
    normalizedInput = normalizeVirtualCardCreateInput(input);
  } catch {
    normalizedInput = null;
  }
  const scopeKey = virtualCardCreateScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    input,
    sessionIdentity.current.generation,
    inputIdentity.current.generation,
    backendRuntime.error === null ? backendRuntime.apiUrl : "",
  );
  const [state, dispatch] = useReducer(virtualCardCreateReducer, initialVirtualCardCreateState);
  const gate = useRef(createVirtualCardCreateGate(scopeKey));
  const activeAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const previousScope = gate.current.scopeKey;
  syncVirtualCardCreateScope(gate.current, scopeKey);
  if (previousScope !== scopeKey) {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }
  const view = virtualCardCreateView(state, scopeKey);

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
      syncVirtualCardCreateScope(currentGate, null);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !normalizedInput || !session) return false;
    const ticket = beginVirtualCardCreate(gate.current, scopeKey);
    if (!ticket) return false;
    const controller = new AbortController();
    activeAbort.current = controller;
    let createPostSucceeded = false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const card = await backendApi.createVirtualCard(
        normalizedInput,
        ticket.idempotencyKey,
        controller.signal,
      );
      createPostSucceeded = true;
      if (
        card.currency !== normalizedInput.currency ||
        (normalizedInput.alias !== undefined && card.alias !== normalizedInput.alias)
      ) {
        throw new Error("Created Card does not match the submitted input");
      }
      if (!mounted.current || !acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      const isCurrent = () =>
        mounted.current && acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey);
      if (!(await onCreated(card, isCurrent, controller.signal))) {
        throw new Error("Created Card was not confirmed by the bounded Card list");
      }
      if (!isCurrent()) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card });
      return true;
    } catch (error) {
      const current =
        mounted.current && acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      const invalidationReason = backendSessionInvalidationReasonFromError(error);
      if (invalidationReason) {
        if (createPostSucceeded) onUnconfirmed();
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_CREATE_ERROR });
        invalidateSession?.(session, invalidationReason);
      } else if (createPostSucceeded && blockVirtualCardCreate(gate.current, ticket, scopeKey)) {
        onUnconfirmed();
        dispatch({
          type: "conflicted",
          requestKey: ticket.requestKey,
          message: SAFE_CREATE_CONFLICT_ERROR,
        });
      } else {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_CREATE_ERROR });
      }
      return false;
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null;
      if (mounted.current && settleVirtualCardCreate(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [invalidateSession, normalizedInput, onCreated, onUnconfirmed, scopeKey, session]);

  return {
    ...view,
    allowed: scopeKey !== null,
    canSubmit: scopeKey !== null && !view.conflictPending,
    submit,
  };
}
