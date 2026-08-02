import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  WALLET_OPERATION_FILTER_VERSION,
  WALLET_OPERATION_PAGE_SIZE,
  WALLET_OPERATION_STATUSES,
  WALLET_OPERATION_TYPES,
  backendApi,
  type BackendSession,
  type WalletOperationStatusFilter,
  type WalletOperationTypeFilter,
} from "@/lib/backend-api";
import {
  initialWalletOperationState,
  walletOperationErrorMessage,
  walletOperationReducer,
  walletOperationRequestKey,
  walletOperationViewForScope,
} from "@/lib/wallet-operation-state";

export type WalletOperationFilterSelection = {
  type: "ALL" | WalletOperationTypeFilter;
  status: "ALL" | WalletOperationStatusFilter;
};

const defaultFilters: WalletOperationFilterSelection = { type: "ALL", status: "ALL" };

function operationFilterKey(filters: WalletOperationFilterSelection): string {
  return JSON.stringify([WALLET_OPERATION_FILTER_VERSION, filters.type, filters.status]);
}

function operationScopeKey(session: BackendSession | null, filterKey: string): string | null {
  return session
    ? JSON.stringify([
        session.actorId,
        session.expiresAt ?? null,
        session.tenantId,
        session.customerId,
        session.environment,
        "ALL_OWNED_WALLET_ACCOUNTS",
        filterKey,
      ])
    : null;
}

function operationQuery(filters: WalletOperationFilterSelection, cursor?: string) {
  return {
    limit: WALLET_OPERATION_PAGE_SIZE,
    ...(filters.type === "ALL" ? {} : { type: filters.type }),
    ...(filters.status === "ALL" ? {} : { status: filters.status }),
    ...(cursor ? { cursor } : {}),
  };
}

function validFilters(value: WalletOperationFilterSelection): boolean {
  return (
    (value.type === "ALL" || WALLET_OPERATION_TYPES.includes(value.type)) &&
    (value.status === "ALL" || WALLET_OPERATION_STATUSES.includes(value.status))
  );
}

type RefreshInput = {
  scopeKey: string;
  filterKey: string;
  session: BackendSession;
  filters: WalletOperationFilterSelection;
};

export function useWalletOperations(session: BackendSession | null) {
  const [state, dispatch] = useReducer(walletOperationReducer, initialWalletOperationState);
  const [filters, setFilters] = useState<WalletOperationFilterSelection>(defaultFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const filterKey = operationFilterKey(filters);
  const scopeKey = operationScopeKey(session, filterKey);
  const view = walletOperationViewForScope(state, scopeKey, filterKey);
  const refreshInput = useRef<RefreshInput | null>(null);
  refreshInput.current =
    session && scopeKey && view.scopeReady && !view.loading
      ? { scopeKey, filterKey, session, filters }
      : null;

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = ++requestSequence.current;
    const requestKey = scopeKey
      ? walletOperationRequestKey(scopeKey, filterKey, null, generation)
      : null;
    dispatch({ type: "reset", scopeKey, filterKey, requestKey, loading: scopeKey !== null });
    if (!session || !scopeKey || !requestKey) {
      activeRequest.current = null;
      return () => controller.abort();
    }
    void backendApi
      .walletOperations(session, operationQuery(filters), controller.signal)
      .then((page) =>
        dispatch({ type: "page", requestKey, requestCursor: null, page, append: false }),
      )
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestKey,
          message: walletOperationErrorMessage(reason),
          append: false,
        }),
      )
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        dispatch({ type: "settled", requestKey });
      });
    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [filterKey, filters, scopeKey, session]);

  const changeFilters = useCallback((next: WalletOperationFilterSelection) => {
    if (!validFilters(next) || operationFilterKey(next) === operationFilterKey(filtersRef.current))
      return;
    activeRequest.current?.abort();
    activeRequest.current = null;
    requestSequence.current += 1;
    filtersRef.current = next;
    setFilters(next);
  }, []);

  const refresh = useCallback(() => {
    const input = refreshInput.current;
    if (!input || activeRequest.current !== null) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestKey = walletOperationRequestKey(
      input.scopeKey,
      input.filterKey,
      null,
      ++requestSequence.current,
    );
    dispatch({
      type: "refreshing",
      scopeKey: input.scopeKey,
      filterKey: input.filterKey,
      requestKey,
    });
    void backendApi
      .walletOperations(input.session, operationQuery(input.filters), controller.signal)
      .then((page) => dispatch({ type: "refreshed", requestKey, page }))
      .catch(() =>
        dispatch({
          type: "refresh-failed",
          requestKey,
          message: "Wallet activity refresh failed",
        }),
      )
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        dispatch({ type: "settled", requestKey });
      });
  }, []);

  const loadMore = useCallback(async () => {
    if (
      !session ||
      state.scopeKey !== scopeKey ||
      state.filterKey !== filterKey ||
      !scopeKey ||
      !state.nextCursor ||
      state.loading ||
      state.loadingMore ||
      state.refreshing ||
      activeRequest.current !== null
    )
      return;
    const requestCursor = state.nextCursor;
    const requestKey = walletOperationRequestKey(
      scopeKey,
      filterKey,
      requestCursor,
      ++requestSequence.current,
    );
    const controller = new AbortController();
    activeRequest.current = controller;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.walletOperations(
        session,
        operationQuery(filters, requestCursor),
        controller.signal,
      );
      dispatch({ type: "page", requestKey, requestCursor, page, append: true });
    } catch (reason) {
      dispatch({
        type: "failed",
        requestKey,
        message: walletOperationErrorMessage(reason),
        append: true,
      });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      dispatch({ type: "settled", requestKey });
    }
  }, [filterKey, filters, scopeKey, session, state]);

  return {
    ...view,
    filters,
    changeFilters,
    loadMore,
    refresh,
    canRefresh:
      refreshInput.current !== null &&
      activeRequest.current === null &&
      !view.refreshing &&
      !view.loadingMore,
  };
}
