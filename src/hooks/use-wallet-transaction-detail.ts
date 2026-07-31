import { useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession, type WalletAccountTransaction } from "@/lib/backend-api";
import {
  initialWalletTransactionDetailState,
  walletTransactionDetailReducer,
  walletTransactionDetailErrorMessage,
  walletTransactionDetailViewForScope,
} from "@/lib/wallet-transaction-detail-state";

export function useWalletTransactionDetail(
  session: BackendSession | null,
  selectedAssetCode: string | null,
  selectedTransaction: WalletAccountTransaction | null,
) {
  const [state, dispatch] = useReducer(
    walletTransactionDetailReducer,
    initialWalletTransactionDetailState,
  );
  const requestSequence = useRef(0);
  const scopeKey =
    session && selectedAssetCode && selectedTransaction
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.environment,
          selectedAssetCode,
          selectedTransaction.id,
        ])
      : null;
  const view = walletTransactionDetailViewForScope(state, scopeKey);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    dispatch({ type: "reset", scopeKey, requestId, loading: scopeKey !== null });
    if (!selectedAssetCode || !selectedTransaction) return;

    void backendApi
      .walletTransactionDetail({
        transactionId: selectedTransaction.id,
        assetCode: selectedAssetCode,
        amount: selectedTransaction.amount,
      })
      .then((detail) => dispatch({ type: "loaded", requestId, detail }))
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestId,
          message: walletTransactionDetailErrorMessage(reason),
        }),
      )
      .finally(() => dispatch({ type: "settled", requestId }));

    return () => {
      if (requestSequence.current === requestId) requestSequence.current += 1;
    };
  }, [scopeKey, selectedAssetCode, selectedTransaction]);

  return view;
}
