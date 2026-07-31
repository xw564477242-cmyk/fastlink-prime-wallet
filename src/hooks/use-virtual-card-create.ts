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
  onCreated: (card: WalletCard) => void,
) {
  const scopeKey = virtualCardCreateScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
  );
  const [state, dispatch] = useReducer(virtualCardCreateReducer, initialVirtualCardCreateState);
  const gate = useRef(createVirtualCardCreateGate(scopeKey));
  syncVirtualCardCreateScope(gate.current, scopeKey);
  const view = virtualCardCreateView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(
    async (input: VirtualCardCreateInput): Promise<boolean> => {
      if (!scopeKey) return false;
      let normalizedInput: VirtualCardCreateInput;
      try {
        normalizedInput = normalizeVirtualCardCreateInput(input);
      } catch {
        return false;
      }
      const ticket = beginVirtualCardCreate(gate.current, scopeKey);
      if (!ticket) return false;
      dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

      try {
        const card = await backendApi.createVirtualCard(normalizedInput, ticket.idempotencyKey);
        if (!acceptsVirtualCardCreateCompletion(gate.current, ticket, scopeKey)) return false;
        dispatch({ type: "succeeded", requestKey: ticket.requestKey, card });
        onCreated(card);
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
    },
    [onCreated, scopeKey],
  );

  return { ...view, allowed: scopeKey !== null, submit };
}
