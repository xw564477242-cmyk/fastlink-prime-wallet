import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  WALLET_TRANSACTION_FILTER_VERSION,
  WALLET_TRANSACTION_PAGE_SIZE,
  backendApi,
  BackendApiError,
  backendRuntime,
  walletTransferAccountReadAllowed,
  type BackendSession,
  type WalletTransactionStatusFilter,
  type WalletTransactionTypeFilter,
  type WalletTransferAccount,
} from "@/lib/backend-api";
import {
  digitalAssetReducer,
  digitalAssetView,
  initialDigitalAssetState,
} from "@/lib/digital-asset-state";
import {
  initialWalletTransactionState,
  walletTransactionReducer,
  walletTransactionRequestKey,
  walletTransactionViewForScope,
} from "@/lib/wallet-transaction-state";
import { walletTransferAccountScopeKey } from "@/lib/wallet-transfer-account-state";
import type { BackendSessionInvalidator } from "@/lib/backend-session-policy";

export type DigitalAssetHistoryFilters = {
  type?: WalletTransactionTypeFilter;
  status?: WalletTransactionStatusFilter;
};

type BaseInput = { scopeKey: string; session: BackendSession };
type HistoryInput = {
  scopeKey: string;
  session: BackendSession;
  account: WalletTransferAccount;
  type?: WalletTransactionTypeFilter;
  status?: WalletTransactionStatusFilter;
};
type ActiveRequest<T> = {
  controller: AbortController;
  input: T;
  requestKey: string;
};

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Railway Backend is unavailable";
}

export function useDigitalAssetHistory(
  session: BackendSession | null,
  filters: DigitalAssetHistoryFilters = {},
  invalidateSession?: BackendSessionInvalidator,
) {
  const [baseState, dispatchBase] = useReducer(digitalAssetReducer, initialDigitalAssetState);
  const [transactionState, dispatchTransaction] = useReducer(
    walletTransactionReducer,
    initialWalletTransactionState,
  );
  const [baseRefresh, setBaseRefresh] = useState({ generation: 0, preserveSnapshot: false });
  const mounted = useRef(false);
  const baseSequence = useRef(0);
  const transactionSequence = useRef(0);
  const activeBase = useRef<ActiveRequest<BaseInput> | null>(null);
  const activeHistory = useRef<ActiveRequest<HistoryInput> | null>(null);
  const sessionIdentity = useRef({ session, generation: 0 });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const transferScope = walletTransferAccountScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    Date.now(),
    sessionIdentity.current.generation,
  );
  const scopeKey =
    transferScope && backendRuntime.apiUrl === "/api"
      ? JSON.stringify([transferScope, backendRuntime.apiUrl])
      : null;
  const baseView = digitalAssetView(baseState, scopeKey);
  const selectedAccount =
    baseView.accounts.find((account) => account.id === baseView.selectedAccountId) ?? null;
  const type = filters.type;
  const status = filters.status;
  const historyScopeKey =
    scopeKey && baseView.snapshotVersion && selectedAccount
      ? JSON.stringify([
          scopeKey,
          baseView.snapshotVersion,
          selectedAccount.id,
          selectedAccount.assetCode,
          WALLET_TRANSACTION_FILTER_VERSION,
          type ?? null,
          status ?? null,
        ])
      : null;
  const transactions = walletTransactionViewForScope(transactionState, historyScopeKey);
  const baseInputRef = useRef<BaseInput | null>(null);
  baseInputRef.current = scopeKey && session ? { scopeKey, session } : null;
  const historyInputRef = useRef<HistoryInput | null>(null);
  historyInputRef.current =
    historyScopeKey && session && selectedAccount
      ? { scopeKey: historyScopeKey, session, account: selectedAccount, type, status }
      : null;
  const transactionViewRef = useRef(transactions);
  transactionViewRef.current = transactions;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeBase.current?.controller.abort();
      activeHistory.current?.controller.abort();
      activeBase.current = null;
      activeHistory.current = null;
      baseSequence.current += 1;
      transactionSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    activeBase.current?.controller.abort();
    activeBase.current = null;
    const generation = ++baseSequence.current;
    const requestKey = scopeKey
      ? JSON.stringify([scopeKey, baseRefresh.generation, generation])
      : null;
    dispatchBase({
      type: "reset",
      scopeKey,
      requestKey,
      preserveSnapshot: baseRefresh.preserveSnapshot,
    });
    if (!requestKey || !scopeKey || !session) return;
    const controller = new AbortController();
    const input = { scopeKey, session };
    const request = { controller, input, requestKey };
    activeBase.current = request;
    const isCurrent = () =>
      mounted.current &&
      activeBase.current === request &&
      baseInputRef.current?.scopeKey === input.scopeKey &&
      baseInputRef.current.session === input.session &&
      walletTransferAccountReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );
    void Promise.all([
      backendApi.walletAssets(session, controller.signal),
      backendApi.walletTransferAccounts(session, controller.signal),
    ])
      .then(([catalog, ownedAccounts]) => {
        if (!isCurrent()) return;
        const digitalCodes = new Set(
          catalog.items
            .filter((asset) => asset.assetClass === "DIGITAL")
            .map((asset) => asset.assetCode),
        );
        const accounts = ownedAccounts.filter((account) => digitalCodes.has(account.assetCode));
        dispatchBase({
          type: "loaded",
          requestKey,
          accounts,
          snapshotVersion: JSON.stringify([catalog.environment, catalog.items, accounts]),
        });
      })
      .catch((reason: unknown) => {
        if (!isCurrent()) return;
        controller.abort();
        const mayPreserveSnapshot =
          baseRefresh.preserveSnapshot &&
          reason instanceof BackendApiError &&
          (reason.status === 0 ||
            reason.status === 408 ||
            reason.status === 429 ||
            (reason.status >= 500 && reason.status <= 599));
        dispatchBase({
          type: "failed",
          requestKey,
          preserveSnapshot: mayPreserveSnapshot,
        });
        if (reason instanceof BackendApiError && reason.status === 401) {
          invalidateSession?.(session, "EXPLICIT_401");
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeBase.current = null;
        dispatchBase({ type: "settled", requestKey });
      });
    return () => {
      if (activeBase.current === request) activeBase.current = null;
      controller.abort();
      baseSequence.current += 1;
    };
  }, [baseRefresh, invalidateSession, scopeKey, session]);

  useEffect(() => {
    activeHistory.current?.controller.abort();
    activeHistory.current = null;
    const generation = ++transactionSequence.current;
    const requestKey = historyScopeKey
      ? walletTransactionRequestKey(historyScopeKey, null, generation)
      : null;
    dispatchTransaction({
      type: "reset",
      scopeKey: historyScopeKey,
      requestKey,
      loading: historyScopeKey !== null,
    });
    const input = historyInputRef.current;
    if (!requestKey || !input) return;
    const controller = new AbortController();
    const request = { controller, input, requestKey };
    activeHistory.current = request;
    const isCurrent = () =>
      mounted.current &&
      activeHistory.current === request &&
      historyInputRef.current?.scopeKey === input.scopeKey &&
      historyInputRef.current.session === input.session &&
      historyInputRef.current.account.id === input.account.id &&
      walletTransferAccountReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );
    void backendApi
      .walletOwnedAccountTransactions(
        input.session,
        input.account,
        {
          assetCode: input.account.assetCode,
          type: input.type,
          status: input.status,
          limit: WALLET_TRANSACTION_PAGE_SIZE,
        },
        controller.signal,
      )
      .then((page) => {
        if (isCurrent()) {
          dispatchTransaction({
            type: "page",
            requestKey,
            requestCursor: null,
            page,
            append: false,
          });
        }
      })
      .catch((reason: unknown) => {
        if (!isCurrent()) return;
        dispatchTransaction({
          type: "failed",
          requestKey,
          message: message(reason),
          append: false,
        });
        if (reason instanceof BackendApiError && reason.status === 401) {
          invalidateSession?.(input.session, "EXPLICIT_401");
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeHistory.current = null;
        dispatchTransaction({ type: "settled", requestKey });
      });
    return () => {
      if (activeHistory.current === request) activeHistory.current = null;
      controller.abort();
      transactionSequence.current += 1;
    };
  }, [historyScopeKey, invalidateSession]);

  const selectAccount = useCallback(
    (accountId: string) => {
      activeHistory.current?.controller.abort();
      dispatchBase({ type: "select", scopeKey, accountId });
    },
    [scopeKey],
  );

  const refreshAssets = useCallback(() => {
    if (!baseInputRef.current || activeBase.current) return;
    setBaseRefresh((current) => ({
      generation: current.generation + 1,
      preserveSnapshot: true,
    }));
  }, []);

  const refreshHistory = useCallback(() => {
    const input = historyInputRef.current;
    const currentView = transactionViewRef.current;
    if (!input || activeHistory.current || currentView.loading || !currentView.scopeReady) return;
    const generation = ++transactionSequence.current;
    const requestKey = walletTransactionRequestKey(input.scopeKey, null, generation);
    const controller = new AbortController();
    const request = { controller, input, requestKey };
    activeHistory.current = request;
    dispatchTransaction({ type: "refreshing", scopeKey: input.scopeKey, requestKey });
    const isCurrent = () =>
      mounted.current &&
      activeHistory.current === request &&
      historyInputRef.current?.scopeKey === input.scopeKey &&
      historyInputRef.current.session === input.session &&
      historyInputRef.current.account.id === input.account.id &&
      walletTransferAccountReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );
    void backendApi
      .walletOwnedAccountTransactions(
        input.session,
        input.account,
        {
          assetCode: input.account.assetCode,
          type: input.type,
          status: input.status,
          limit: WALLET_TRANSACTION_PAGE_SIZE,
        },
        controller.signal,
      )
      .then((page) => {
        if (isCurrent()) dispatchTransaction({ type: "refreshed", requestKey, page });
      })
      .catch((reason: unknown) => {
        if (!isCurrent()) return;
        if (reason instanceof BackendApiError && reason.status === 401) {
          dispatchTransaction({
            type: "reset",
            scopeKey: input.scopeKey,
            requestKey: null,
            loading: false,
          });
          invalidateSession?.(input.session, "EXPLICIT_401");
        } else {
          dispatchTransaction({
            type: "refresh-failed",
            requestKey,
            message: "Digital asset history refresh failed",
          });
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeHistory.current = null;
        dispatchTransaction({ type: "settled", requestKey });
      });
  }, [invalidateSession]);

  const loadMore = useCallback(async () => {
    const input = historyInputRef.current;
    const currentView = transactionViewRef.current;
    if (
      !input ||
      activeHistory.current ||
      !currentView.nextCursor ||
      currentView.loading ||
      currentView.loadingMore ||
      currentView.refreshing
    ) {
      return;
    }
    const requestCursor = currentView.nextCursor;
    const generation = ++transactionSequence.current;
    const requestKey = walletTransactionRequestKey(input.scopeKey, requestCursor, generation);
    const controller = new AbortController();
    const request = { controller, input, requestKey };
    activeHistory.current = request;
    dispatchTransaction({ type: "loading-more", requestKey, requestCursor });
    const isCurrent = () =>
      mounted.current &&
      activeHistory.current === request &&
      historyInputRef.current?.scopeKey === input.scopeKey &&
      historyInputRef.current.session === input.session &&
      historyInputRef.current.account.id === input.account.id &&
      walletTransferAccountReadAllowed(
        input.session,
        backendRuntime.environment,
        backendRuntime.apiUrl,
      );
    try {
      const page = await backendApi.walletOwnedAccountTransactions(
        input.session,
        input.account,
        {
          assetCode: input.account.assetCode,
          type: input.type,
          status: input.status,
          limit: WALLET_TRANSACTION_PAGE_SIZE,
          cursor: requestCursor,
        },
        controller.signal,
      );
      if (isCurrent()) {
        dispatchTransaction({ type: "page", requestKey, requestCursor, page, append: true });
      }
    } catch (reason) {
      if (isCurrent()) {
        if (reason instanceof BackendApiError && reason.status === 401) {
          dispatchTransaction({
            type: "reset",
            scopeKey: input.scopeKey,
            requestKey: null,
            loading: false,
          });
          invalidateSession?.(input.session, "EXPLICIT_401");
        } else {
          dispatchTransaction({
            type: "failed",
            requestKey,
            message: message(reason),
            append: true,
          });
        }
      }
    } finally {
      if (isCurrent()) {
        activeHistory.current = null;
        dispatchTransaction({ type: "settled", requestKey });
      }
    }
  }, [invalidateSession]);

  return {
    assets: { ...baseView, selectedAccount },
    transactions,
    selectAccount,
    refreshAssets,
    refreshHistory,
    loadMore,
    canRefreshAssets: Boolean(baseInputRef.current && !activeBase.current),
    canRefreshHistory: Boolean(
      historyInputRef.current &&
      !activeHistory.current &&
      transactions.scopeReady &&
      !transactions.loading &&
      !transactions.loadingMore &&
      !transactions.refreshing,
    ),
  };
}
