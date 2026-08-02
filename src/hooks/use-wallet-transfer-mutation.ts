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
  clearWalletTransferMutationRetry,
  createWalletTransferMutationGate,
  invalidateWalletTransferMutationGate,
  initialWalletTransferMutationState,
  retainWalletTransferMutationRetry,
  settleWalletTransferMutation,
  syncWalletTransferMutationScope,
  walletTransferMutationReducer,
  walletTransferMutationScopeKey,
  walletTransferMutationView,
  walletTransferFailureIsAmbiguous,
  walletTransferFailureIsExplicit401,
} from "@/lib/wallet-transfer-mutation-state";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

const SAFE_WALLET_TRANSFER_ERROR =
  "Wallet transfer was not accepted. Check the account and amount.";
const SAFE_WALLET_TRANSFER_AMBIGUOUS_ERROR =
  "Transfer result is uncertain. Retry manually to reuse the same request key.";

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
  invalidateSession?: BackendSessionInvalidator,
) {
  const sessionIdentity = useRef({ session, generation: 0 });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const scopeKey = walletTransferMutationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    source,
    input,
    sessionIdentity.current.generation,
  );
  const [state, dispatch] = useReducer(
    walletTransferMutationReducer,
    initialWalletTransferMutationState,
  );
  const gate = useRef(createWalletTransferMutationGate(scopeKey));
  const mounted = useRef(false);
  syncWalletTransferMutationScope(gate.current, scopeKey);
  const view = walletTransferMutationView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  useEffect(() => {
    const currentGate = gate.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateWalletTransferMutationGate(currentGate);
    };
  }, []);

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
      if (
        !mounted.current ||
        !acceptsWalletTransferMutationCompletion(gate.current, ticket, scopeKey)
      )
        return false;
      clearWalletTransferMutationRetry(gate.current);
      dispatch({ type: "succeeded", requestKey: ticket.requestKey, operation });
      onAccepted({
        operation,
        input: ticket.input,
        transferRequestKey: ticket.requestKey,
        transferGeneration: ticket.generation,
      });
      return true;
    } catch (reason) {
      const current =
        mounted.current && acceptsWalletTransferMutationCompletion(gate.current, ticket, scopeKey);
      if (!current) return false;
      if (walletTransferFailureIsExplicit401(reason)) {
        clearWalletTransferMutationRetry(gate.current);
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_WALLET_TRANSFER_ERROR,
        });
        invalidateSession?.(session, "EXPLICIT_401");
      } else if (
        walletTransferFailureIsAmbiguous(reason) &&
        retainWalletTransferMutationRetry(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "retryable",
          requestKey: ticket.requestKey,
          message: SAFE_WALLET_TRANSFER_AMBIGUOUS_ERROR,
        });
      } else {
        clearWalletTransferMutationRetry(gate.current);
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_WALLET_TRANSFER_ERROR,
        });
      }
      return false;
    } finally {
      if (mounted.current && settleWalletTransferMutation(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [input, invalidateSession, onAccepted, scopeKey, session, source]);

  return { ...view, allowed: scopeKey !== null, submit };
}
