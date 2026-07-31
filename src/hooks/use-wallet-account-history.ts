import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  WALLET_TRANSACTION_FILTER_VERSION,
  WALLET_TRANSACTION_PAGE_SIZE,
  backendApi,
  type BackendSession,
  type WalletTransactionStatusFilter,
  type WalletTransactionTypeFilter,
} from "@/lib/backend-api";
import {
  initialWalletAccountState,
  captureWalletBalanceAccountsVersion,
  walletBalanceSessionKey,
  walletAccountReducer,
  walletAccountViewForSession,
} from "@/lib/wallet-account-state";
import {
  initialWalletTransactionState,
  walletTransactionReducer,
  walletTransactionRequestKey,
  walletTransactionViewForScope,
} from "@/lib/wallet-transaction-state";

export type WalletTransactionFilters = {
  type?: WalletTransactionTypeFilter;
  status?: WalletTransactionStatusFilter;
};

function failure(reason: unknown) {
  return reason instanceof Error ? reason.message : "Railway Backend is unavailable";
}

export function useWalletAccountHistory(
  session: BackendSession | null,
  filters: WalletTransactionFilters = {},
) {
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
  const activeTransactionRequest = useRef<AbortController | null>(null);
  const sessionKey = walletBalanceSessionKey(session);
  const accountView = walletAccountViewForSession(accountState, sessionKey);
  const accountsVersionRef = useRef(accountView.accountsVersion);
  accountsVersionRef.current = accountView.accountsVersion;
  const selectedAssetCode = accountView.selectedAssetCode;
  const type = filters.type;
  const status = filters.status;
  const transactionScopeKey =
    session && selectedAssetCode
      ? JSON.stringify([
          session.actorId,
          session.expiresAt ?? null,
          session.tenantId,
          session.customerId,
          session.environment,
          selectedAssetCode,
          WALLET_TRANSACTION_FILTER_VERSION,
          type ?? null,
          status ?? null,
        ])
      : null;
  const transactionView = walletTransactionViewForScope(transactionState, transactionScopeKey);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++accountSequence.current;
    const identity = {
      sessionKey,
      requestId,
      accountsVersion: accountsVersionRef.current,
    };
    dispatchAccount({ type: "reset", identity, loading: session !== null });
    if (!session) return () => controller.abort();
    void backendApi
      .walletBalanceAccounts(session.environment, controller.signal)
      .then((accounts) =>
        dispatchAccount({
          type: "loaded",
          identity,
          accounts,
          accountsVersion: captureWalletBalanceAccountsVersion(accounts),
        }),
      )
      .catch((reason) => dispatchAccount({ type: "failed", identity, message: failure(reason) }))
      .finally(() => dispatchAccount({ type: "settled", identity }));
    return () => {
      controller.abort();
      if (accountSequence.current === requestId) accountSequence.current += 1;
    };
  }, [session, sessionKey]);

  useEffect(() => {
    activeTransactionRequest.current?.abort();
    const controller = new AbortController();
    activeTransactionRequest.current = controller;
    const generation = ++transactionSequence.current;
    const requestKey = transactionScopeKey
      ? walletTransactionRequestKey(transactionScopeKey, null, generation)
      : null;
    dispatchTransaction({
      type: "reset",
      scopeKey: transactionScopeKey,
      requestKey,
      loading: transactionScopeKey !== null,
    });
    if (!session || !selectedAssetCode || !requestKey) {
      return () => controller.abort();
    }
    void backendApi
      .walletTransactions(
        session,
        { assetCode: selectedAssetCode, type, status, limit: WALLET_TRANSACTION_PAGE_SIZE },
        controller.signal,
      )
      .then((page) =>
        dispatchTransaction({ requestCursor: null, type: "page", requestKey, page, append: false }),
      )
      .catch((reason) =>
        dispatchTransaction({
          type: "failed",
          requestKey,
          message: failure(reason),
          append: false,
        }),
      )
      .finally(() => {
        if (activeTransactionRequest.current === controller) {
          activeTransactionRequest.current = null;
        }
        dispatchTransaction({ type: "settled", requestKey });
      });
    return () => {
      controller.abort();
      if (activeTransactionRequest.current === controller) activeTransactionRequest.current = null;
      if (transactionSequence.current === generation) transactionSequence.current += 1;
    };
  }, [selectedAssetCode, session, status, transactionScopeKey, type]);

  const selectAccount = useCallback(
    (assetCode: string) => {
      activeTransactionRequest.current?.abort();
      dispatchAccount({ type: "select", sessionKey, assetCode });
    },
    [sessionKey],
  );

  const loadMore = useCallback(async () => {
    if (
      !session ||
      transactionState.scopeKey !== transactionScopeKey ||
      !transactionScopeKey ||
      !selectedAssetCode ||
      !transactionState.nextCursor ||
      transactionState.loading ||
      transactionState.loadingMore
    ) {
      return;
    }
    const requestCursor = transactionState.nextCursor;
    const generation = ++transactionSequence.current;
    const requestKey = walletTransactionRequestKey(transactionScopeKey, requestCursor, generation);
    activeTransactionRequest.current?.abort();
    const controller = new AbortController();
    activeTransactionRequest.current = controller;
    dispatchTransaction({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.walletTransactions(
        session,
        {
          assetCode: selectedAssetCode,
          type,
          status,
          limit: WALLET_TRANSACTION_PAGE_SIZE,
          cursor: requestCursor,
        },
        controller.signal,
      );
      dispatchTransaction({ type: "page", requestKey, requestCursor, page, append: true });
    } catch (reason) {
      dispatchTransaction({ type: "failed", requestKey, message: failure(reason), append: true });
    } finally {
      if (activeTransactionRequest.current === controller) activeTransactionRequest.current = null;
      dispatchTransaction({ type: "settled", requestKey });
    }
  }, [selectedAssetCode, session, status, transactionScopeKey, transactionState, type]);

  return { accounts: accountView, transactions: transactionView, selectAccount, loadMore };
}
