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
  createVirtualCardCreateGate,
  initialVirtualCardCreateState,
  settleVirtualCardCreate,
  syncVirtualCardCreateScope,
  virtualCardCreateReducer,
  virtualCardCreateScopeKey,
  virtualCardCreateView,
} from "@/lib/virtual-card-create-state";

const SAFE_CREATE_ERROR = "Virtual Card creation failed. Try again.";

export function useVirtualCardCreate(
  session: BackendSession | null,
  input: VirtualCardCreateInput,
  onCreated: (card: WalletCard, isCurrent: () => boolean) => boolean | Promise<boolean>,
) {
  let normalizedInput: VirtualCardCreateInput | null = null;
  try {
    normalizedInput = normalizeVirtualCardCreateInput(input);
  } catch {
    normalizedInput = null;
  }
  const sessionScopeKey = virtualCardCreateScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
  );
  const scopeKey =
    sessionScopeKey && normalizedInput
      ? JSON.stringify([sessionScopeKey, normalizedInput.currency, normalizedInput.alias ?? null])
      : null;
  const [state, dispatch] = useReducer(virtualCardCreateReducer, initialVirtualCardCreateState);
  const gate = useRef(createVirtualCardCreateGate(scopeKey));
  syncVirtualCardCreateScope(gate.current, scopeKey);
  const view = virtualCardCreateView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !normalizedInput) return false;
    const ticket = beginVirtualCardCreate(gate.current, scopeKey);
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const card = await backendApi.createVirtualCard(normalizedInput, ticket.idempotencyKey);
      if (!acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey)) return false;
      const isCurrent = () => acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey);
      if (!(await onCreated(card, isCurrent))) {
        throw new Error("Created Card ownership was not confirmed");
      }
      if (!acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey)) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, card });
      return true;
    } catch {
      if (acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey)) {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: SAFE_CREATE_ERROR });
      }
      return false;
    } finally {
      if (settleVirtualCardCreate(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [normalizedInput, onCreated, scopeKey]);

  return { ...view, allowed: scopeKey !== null, submit };
}
