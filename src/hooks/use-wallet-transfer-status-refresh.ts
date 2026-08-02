import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  backendRuntime,
  type BackendSession,
  type WalletOperationActivity,
} from "@/lib/backend-api";
import {
  acceptsWalletTransferStatusRefreshCompletion,
  beginWalletTransferStatusRefresh,
  createWalletTransferStatusRefreshGate,
  invalidateWalletTransferStatusRefreshGate,
  initialWalletTransferStatusRefreshState,
  settleWalletTransferStatusRefresh,
  syncWalletTransferStatusRefreshScope,
  walletTransferStatusRefreshReducer,
  walletTransferStatusRefreshScopeKey,
  walletTransferStatusRefreshView,
  type WalletTransferReceiptContext,
} from "@/lib/wallet-transfer-status-refresh-state";
import {
  backendSessionInvalidationReasonFromError,
  type BackendSessionInvalidator,
} from "@/lib/backend-session-policy";

export const SAFE_STATUS_REFRESH_ERROR =
  "Wallet transfer status is unavailable. Try a manual refresh.";

export type WalletTransferStatusReadResult =
  | Readonly<{ ok: true; operation: WalletOperationActivity }>
  | Readonly<{ ok: false; message: typeof SAFE_STATUS_REFRESH_ERROR }>;

export async function readWalletTransferStatusSafely(
  session: BackendSession,
  previous: WalletOperationActivity,
  onError?: (reason: unknown) => void,
): Promise<WalletTransferStatusReadResult> {
  try {
    return {
      ok: true,
      operation: await backendApi.walletTransferStatus(session, { previous }),
    };
  } catch (reason) {
    onError?.(reason);
    return { ok: false, message: SAFE_STATUS_REFRESH_ERROR };
  }
}

export function useWalletTransferStatusRefresh(
  session: BackendSession | null,
  context: WalletTransferReceiptContext | null,
  onRefreshed: (operation: WalletOperationActivity) => void,
  invalidateSession?: BackendSessionInvalidator,
) {
  const sessionIdentity = useRef({ session, generation: 0 });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const scopeKey = walletTransferStatusRefreshScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    context,
    sessionIdentity.current.generation,
  );
  const [state, dispatch] = useReducer(
    walletTransferStatusRefreshReducer,
    initialWalletTransferStatusRefreshState,
  );
  const gate = useRef(createWalletTransferStatusRefreshGate(scopeKey));
  const mounted = useRef(false);
  syncWalletTransferStatusRefreshScope(gate.current, scopeKey);
  const view = walletTransferStatusRefreshView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  useEffect(() => {
    const currentGate = gate.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateWalletTransferStatusRefreshGate(currentGate);
    };
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !context || !session) return false;
    const ticket = beginWalletTransferStatusRefresh(gate.current, scopeKey);
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });
    try {
      let failure: unknown;
      const result = await readWalletTransferStatusSafely(session, context.operation, (reason) => {
        failure = reason;
      });
      if (
        !mounted.current ||
        !acceptsWalletTransferStatusRefreshCompletion(gate.current, ticket, scopeKey)
      ) {
        return false;
      }
      if (!result.ok) {
        dispatch({ type: "failed", requestKey: ticket.requestKey, message: result.message });
        if (backendSessionInvalidationReasonFromError(failure) === "EXPLICIT_401") {
          invalidateSession?.(session, "EXPLICIT_401");
        }
        return false;
      }
      dispatch({ type: "loaded", requestKey: ticket.requestKey, operation: result.operation });
      onRefreshed(result.operation);
      return true;
    } catch {
      if (
        mounted.current &&
        acceptsWalletTransferStatusRefreshCompletion(gate.current, ticket, scopeKey)
      ) {
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_STATUS_REFRESH_ERROR,
        });
      }
      return false;
    } finally {
      if (mounted.current && settleWalletTransferStatusRefresh(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [context, invalidateSession, onRefreshed, scopeKey, session]);

  return { ...view, allowed: scopeKey !== null, refresh };
}
