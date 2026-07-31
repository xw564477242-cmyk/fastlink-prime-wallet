import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type WalletOperationActivity,
  type WalletTransferAccount,
  type WalletTransferInput,
} from "@/lib/backend-api";
import {
  acceptsWalletTransferMutationCompletion,
  beginWalletTransferMutation,
  createWalletTransferMutationGate,
  initialWalletTransferMutationState,
  settleWalletTransferMutation,
  syncWalletTransferMutationScope,
  walletTransferMutationReducer,
  walletTransferMutationScopeKey,
  walletTransferMutationView,
} from "@/lib/wallet-transfer-mutation-state";

const SAFE_WALLET_TRANSFER_ERROR =
  "Wallet transfer was not accepted. Check the account and amount.";

export type AcceptedWalletTransfer = Readonly<{
  operation: WalletOperationActivity;
  input: WalletTransferInput;
  transferRequestKey: string;
  transferGeneration: number;
}>;

export function useWalletTransferMutation(
  session: BackendSession | null,
  source: WalletTransferAccount | null,
  input: unknown,
  onAccepted: (accepted: AcceptedWalletTransfer) => void,
) {
  const scopeKey = walletTransferMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    source,
    input,
  );
  const [state, dispatch] = useReducer(
    walletTransferMutationReducer,
    initialWalletTransferMutationState,
  );
  const gate = useRef(createWalletTransferMutationGate(scopeKey));
  syncWalletTransferMutationScope(gate.current, scopeKey);
  const view = walletTransferMutationView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !session || !source) return false;
    let ticket;
    try {
      ticket = beginWalletTransferMutation(gate.current, scopeKey, source, input);
    } catch {
      return false;
    }
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });

    try {
      const operation = await backendApi.createWalletTransfer(
        session,
        source,
        ticket.input,
        ticket.idempotencyKey,
      );
      if (!acceptsWalletTransferMutationCompletion(gate.current, ticket, scopeKey)) return false;
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, operation });
      onAccepted({
        operation,
        input: ticket.input,
        transferRequestKey: ticket.requestKey,
        transferGeneration: ticket.generation,
      });
      return true;
    } catch {
      if (acceptsWalletTransferMutationCompletion(gate.current, ticket, scopeKey)) {
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_WALLET_TRANSFER_ERROR,
        });
      }
      return false;
    } finally {
      if (settleWalletTransferMutation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [input, onAccepted, scopeKey, session, source]);

  return { ...view, allowed: scopeKey !== null, submit };
}
