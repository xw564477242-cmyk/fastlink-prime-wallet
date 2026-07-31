import { useCallback, useEffect, useReducer, useRef } from "react";
import { WALLET_TRANSACTION_PAGE_SIZE, backendApi, type BackendSession } from "@/lib/backend-api";
import {
  initialWalletAccountState,
  walletAccountReducer,
  walletAccountViewForSession,
} from "@/lib/wallet-account-state";
import {
  initialWalletTransactionState,
  walletTransactionReducer,
  walletTransactionViewForScope,
} from "@/lib/wallet-transaction-state";

function failure(reason: unknown) {
  return reason instanceof Error ? reason.message : "Railway Backend is unavailable";
}

export function useWalletAccountHistory(session: BackendSession | null) {
  const [accountState, dispatchAccount] = useReducer(
    walletAccountReducer,
    initialWalletAccountState,
  );
  const [transactionState, dispatchTransaction] = useReducer(
    walletTransactionReducer,
    initialWalletTransactionState,
  );
  const accountSequence = useRef(0);
  const transactionSequence = useRef(0);
  const sessionKey = session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;
  const accountView = walletAccountViewForSession(accountState, sessionKey);
  const selectedAssetCode = accountView.selectedAssetCode;
  const transactionScopeKey =
    session && selectedAssetCode
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.environment,
          selectedAssetCode,
        ])
      : null;
  const transactionView = walletTransactionViewForScope(transactionState, transactionScopeKey);

  useEffect(() => {
    const requestId = ++accountSequence.current;
    dispatchAccount({ type: "reset", sessionKey, requestId, loading: session !== null });
    if (!session) return;
    void backendApi
      .walletBalanceAccounts()
      .then((accounts) => dispatchAccount({ type: "loaded", requestId, accounts }))
      .catch((reason) => dispatchAccount({ type: "failed", requestId, message: failure(reason) }));
    return () => {
      if (accountSequence.current === requestId) accountSequence.current += 1;
    };
  }, [session, sessionKey]);

  useEffect(() => {
    const requestId = ++transactionSequence.current;
    dispatchTransaction({
      type: "reset",
      scopeKey: transactionScopeKey,
      requestId,
      loading: transactionScopeKey !== null,
    });
    if (!selectedAssetCode) return;
    void backendApi
      .walletTransactions({ assetCode: selectedAssetCode, limit: WALLET_TRANSACTION_PAGE_SIZE })
      .then((page) => dispatchTransaction({ type: "page", requestId, page, append: false }))
      .catch((reason) =>
        dispatchTransaction({ type: "failed", requestId, message: failure(reason), append: false }),
      );
    return () => {
      if (transactionSequence.current === requestId) transactionSequence.current += 1;
    };
  }, [selectedAssetCode, transactionScopeKey]);

  const selectAccount = useCallback(
    (assetCode: string) => dispatchAccount({ type: "select", sessionKey, assetCode }),
    [sessionKey],
  );
  const loadMore = useCallback(async () => {
    if (
      transactionState.scopeKey !== transactionScopeKey ||
      !selectedAssetCode ||
      !transactionState.nextCursor ||
      transactionState.loading ||
      transactionState.loadingMore
    )
      return;
    const requestId = ++transactionSequence.current;
    dispatchTransaction({ type: "loading-more", requestId });
    try {
      const page = await backendApi.walletTransactions({
        assetCode: selectedAssetCode,
        limit: WALLET_TRANSACTION_PAGE_SIZE,
        cursor: transactionState.nextCursor,
      });
      dispatchTransaction({ type: "page", requestId, page, append: true });
    } catch (reason) {
      dispatchTransaction({ type: "failed", requestId, message: failure(reason), append: true });
    }
  }, [selectedAssetCode, transactionScopeKey, transactionState]);

  return { accounts: accountView, transactions: transactionView, selectAccount, loadMore };
}
