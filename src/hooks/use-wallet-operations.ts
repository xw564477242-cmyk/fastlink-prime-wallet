import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  BackendApiError,
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

function operationScopeKey(
  session: BackendSession | null,
  filterKey: string,
  sessionIdentity: number,
): string | null {
  return session
    ? JSON.stringify([
        session.actorId,
        session.expiresAt ?? null,
        session.tenantId,
        session.customerId,
        session.environment,
        sessionIdentity,
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

type ActiveWalletOperationRequest = {
  controller: AbortController;
  input: RefreshInput;
  requestKey: string;
};

function authorizationFailureStatus(reason: unknown): 401 | 403 | 404 | null {
  if (!(reason instanceof BackendApiError)) return null;
  return reason.status === 401 || reason.status === 403 || reason.status === 404
    ? reason.status
    : null;
}

export function useWalletOperations(
  session: BackendSession | null,
  invalidateSession?: (expectedSession: BackendSession) => void,
) {
  const [state, dispatch] = useReducer(walletOperationReducer, initialWalletOperationState);
  const [filters, setFilters] = useState<WalletOperationFilterSelection>(defaultFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const requestSequence = useRef(0);
  const activeRequest = useRef<ActiveWalletOperationRequest | null>(null);
  const mounted = useRef(false);
  const currentInput = useRef<RefreshInput | null>(null);
  const invalidateSessionRef = useRef(invalidateSession);
  invalidateSessionRef.current = invalidateSession;
  const sessionIdentity = useRef<{ session: BackendSession | null; generation: number }>({
    session: null,
    generation: 0,
  });
  if (sessionIdentity.current.session !== session) {
    sessionIdentity.current = {
      session,
      generation: sessionIdentity.current.generation + 1,
    };
  }
  const filterKey = operationFilterKey(filters);
  const scopeKey = operationScopeKey(session, filterKey, sessionIdentity.current.generation);
  const view = walletOperationViewForScope(state, scopeKey, filterKey);
  const refreshInput = useRef<RefreshInput | null>(null);
  currentInput.current = session && scopeKey ? { scopeKey, filterKey, session, filters } : null;
  refreshInput.current =
    session && scopeKey && view.scopeReady && !view.loading
      ? { scopeKey, filterKey, session, filters }
      : null;

  const requestIsCurrent = useCallback(
    (request: ActiveWalletOperationRequest) =>
      mounted.current &&
      activeRequest.current === request &&
      currentInput.current?.session === request.input.session &&
      currentInput.current.scopeKey === request.input.scopeKey &&
      currentInput.current.filterKey === request.input.filterKey,
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.controller.abort();
      activeRequest.current = null;
      requestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
    const generation = ++requestSequence.current;
    const requestKey = scopeKey
      ? walletOperationRequestKey(scopeKey, filterKey, null, generation)
      : null;
    dispatch({ type: "reset", scopeKey, filterKey, requestKey, loading: scopeKey !== null });
    if (!session || !scopeKey || !requestKey) {
      return;
    }
    const input = { scopeKey, filterKey, session, filters };
    const request: ActiveWalletOperationRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;
    void backendApi
      .walletOperations(session, operationQuery(filters), request.controller.signal)
      .then((page) => {
        if (requestIsCurrent(request)) {
          dispatch({ type: "page", requestKey, requestCursor: null, page, append: false });
        }
      })
      .catch((reason) => {
        if (!requestIsCurrent(request)) return;
        const status = authorizationFailureStatus(reason);
        dispatch({
          type: "failed",
          requestKey,
          message: walletOperationErrorMessage(reason),
          append: false,
          clearSnapshot: status !== null,
        });
        if (status === 401) invalidateSessionRef.current?.(session);
      })
      .finally(() => {
        if (requestIsCurrent(request)) dispatch({ type: "settled", requestKey });
        if (activeRequest.current === request) activeRequest.current = null;
      });
    return () => {
      request.controller.abort();
      if (activeRequest.current === request) activeRequest.current = null;
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [filterKey, filters, requestIsCurrent, scopeKey, session]);

  const changeFilters = useCallback((next: WalletOperationFilterSelection) => {
    if (!validFilters(next) || operationFilterKey(next) === operationFilterKey(filtersRef.current))
      return;
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
    requestSequence.current += 1;
    filtersRef.current = next;
    setFilters(next);
  }, []);

  const refresh = useCallback(() => {
    const input = refreshInput.current;
    if (!input || activeRequest.current !== null) return;
    const requestKey = walletOperationRequestKey(
      input.scopeKey,
      input.filterKey,
      null,
      ++requestSequence.current,
    );
    const request: ActiveWalletOperationRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;
    dispatch({
      type: "refreshing",
      scopeKey: input.scopeKey,
      filterKey: input.filterKey,
      requestKey,
    });
    void backendApi
      .walletOperations(input.session, operationQuery(input.filters), request.controller.signal)
      .then((page) => {
        if (requestIsCurrent(request)) dispatch({ type: "refreshed", requestKey, page });
      })
      .catch((reason) => {
        if (!requestIsCurrent(request)) return;
        const status = authorizationFailureStatus(reason);
        dispatch({
          type: "refresh-failed",
          requestKey,
          message: "Wallet activity refresh failed",
          clearSnapshot: status !== null,
        });
        if (status === 401) invalidateSessionRef.current?.(input.session);
      })
      .finally(() => {
        if (requestIsCurrent(request)) dispatch({ type: "settled", requestKey });
        if (activeRequest.current === request) activeRequest.current = null;
      });
  }, [requestIsCurrent]);

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
    const input = { scopeKey, filterKey, session, filters };
    const request: ActiveWalletOperationRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.walletOperations(
        session,
        operationQuery(filters, requestCursor),
        request.controller.signal,
      );
      if (requestIsCurrent(request)) {
        dispatch({ type: "page", requestKey, requestCursor, page, append: true });
      }
    } catch (reason) {
      if (!requestIsCurrent(request)) return;
      const status = authorizationFailureStatus(reason);
      dispatch({
        type: "failed",
        requestKey,
        message: walletOperationErrorMessage(reason),
        append: true,
        clearSnapshot: status !== null,
      });
      if (status === 401) invalidateSessionRef.current?.(session);
    } finally {
      if (requestIsCurrent(request)) dispatch({ type: "settled", requestKey });
      if (activeRequest.current === request) activeRequest.current = null;
    }
  }, [filterKey, filters, requestIsCurrent, scopeKey, session, state]);

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
