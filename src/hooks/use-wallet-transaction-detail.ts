import { useCallback, useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession, type WalletAccountTransaction } from "@/lib/backend-api";
import {
  initialWalletTransactionDetailState,
  walletTransactionDetailReducer,
  walletTransactionDetailErrorMessage,
  walletTransactionDetailRequestKey,
  walletTransactionDetailScopeKey,
  walletTransactionDetailViewForScope,
} from "@/lib/wallet-transaction-detail-state";

type DetailRequestInput = {
  scopeKey: string;
  session: BackendSession;
  selectedAssetCode: string;
  selectedTransaction: WalletAccountTransaction;
};

export function useWalletTransactionDetail(
  session: BackendSession | null,
  selectedAssetCode: string | null,
  selectedTransaction: WalletAccountTransaction | null,
  historyScopeKey: string | null,
) {
  const [state, dispatch] = useReducer(
    walletTransactionDetailReducer,
    initialWalletTransactionDetailState,
  );
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const scopeKey = walletTransactionDetailScopeKey(
    session,
    selectedAssetCode,
    selectedTransaction,
    historyScopeKey,
  );
  const inputRef = useRef<DetailRequestInput | null>(null);
  inputRef.current =
    scopeKey && session && selectedAssetCode && selectedTransaction
      ? { scopeKey, session, selectedAssetCode, selectedTransaction }
      : null;
  const view = walletTransactionDetailViewForScope(state, scopeKey);

  const refresh = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = ++requestSequence.current;
    const requestKey = walletTransactionDetailRequestKey(input.scopeKey, generation);
    dispatch({ type: "begin", scopeKey: input.scopeKey, requestKey });

    void backendApi
      .walletTransactionDetail(
        input.session,
        {
          transactionId: input.selectedTransaction.id,
          assetCode: input.selectedAssetCode,
          amount: input.selectedTransaction.amount,
        },
        controller.signal,
      )
      .then((detail) => dispatch({ type: "loaded", requestKey, detail }))
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestKey,
          message: walletTransactionDetailErrorMessage(reason),
        }),
      )
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        dispatch({ type: "settled", requestKey });
      });
  }, []);

  useEffect(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    dispatch({ type: "reset", scopeKey });
    if (scopeKey) refresh();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
      requestSequence.current += 1;
    };
  }, [refresh, scopeKey]);

  return {
    ...view,
    refresh,
    canRefresh: scopeKey !== null && view.scopeReady,
  };
}
