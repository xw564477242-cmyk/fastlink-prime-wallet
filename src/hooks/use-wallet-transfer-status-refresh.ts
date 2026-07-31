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
  initialWalletTransferStatusRefreshState,
  settleWalletTransferStatusRefresh,
  syncWalletTransferStatusRefreshScope,
  walletTransferStatusRefreshReducer,
  walletTransferStatusRefreshScopeKey,
  walletTransferStatusRefreshView,
  type WalletTransferReceiptContext,
} from "@/lib/wallet-transfer-status-refresh-state";

const SAFE_STATUS_REFRESH_ERROR = "Wallet transfer status is unavailable. Try a manual refresh.";

export function useWalletTransferStatusRefresh(
  session: BackendSession | null,
  context: WalletTransferReceiptContext | null,
  onRefreshed: (operation: WalletOperationActivity) => void,
) {
  const scopeKey = walletTransferStatusRefreshScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    context,
  );
  const [state, dispatch] = useReducer(
    walletTransferStatusRefreshReducer,
    initialWalletTransferStatusRefreshState,
  );
  const gate = useRef(createWalletTransferStatusRefreshGate(scopeKey));
  syncWalletTransferStatusRefreshScope(gate.current, scopeKey);
  const view = walletTransferStatusRefreshView(state, scopeKey);

  useEffect(() => {
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!scopeKey || !context) return false;
    const ticket = beginWalletTransferStatusRefresh(gate.current, scopeKey);
    if (!ticket) return false;
    dispatch({ type: "started", scopeKey, requestKey: ticket.requestKey });
    try {
      const operation = await backendApi.walletTransferStatus({ previous: context.operation });
      if (!acceptsWalletTransferStatusRefreshCompletion(gate.current, ticket, scopeKey)) {
        return false;
      }
      dispatch({ type: "loaded", requestKey: ticket.requestKey, operation });
      onRefreshed(operation);
      return true;
    } catch {
      if (acceptsWalletTransferStatusRefreshCompletion(gate.current, ticket, scopeKey)) {
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          message: SAFE_STATUS_REFRESH_ERROR,
        });
      }
      return false;
    } finally {
      if (settleWalletTransferStatusRefresh(gate.current, ticket, scopeKey)) {
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, [context, onRefreshed, scopeKey]);

  return { ...view, allowed: scopeKey !== null, refresh };
}
