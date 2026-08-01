import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  CARD_TRANSACTION_FILTER_VERSION,
  CARD_TRANSACTION_PAGE_SIZE,
  backendApi,
  isCardTransactionFilter,
  type BackendSession,
  type CardTransactionFilter,
  type CardTransactionStatusFilter,
} from "@/lib/backend-api";
import {
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "@/lib/card-transaction-state";

function errorMessage(): string {
  return "Card transactions are unavailable";
}

type CardHistoryRefreshInput = {
  scopeKey: string;
  session: BackendSession;
  selectedCardId: string;
  status?: CardTransactionStatusFilter;
};

function cardTransactionStatus(
  filter: CardTransactionFilter,
): CardTransactionStatusFilter | undefined {
  return filter === "ALL" ? undefined : filter;
}

function cardTransactionScopeKey(
  session: BackendSession | null,
  selectedCardId: string | null,
  filter: CardTransactionFilter,
): string | null {
  return session && selectedCardId
    ? JSON.stringify([
        session.actorId,
        session.expiresAt ?? null,
        session.tenantId,
        session.customerId,
        session.environment,
        selectedCardId,
        CARD_TRANSACTION_FILTER_VERSION,
        filter,
      ])
    : null;
}

export function useCardTransactionPages(
  session: BackendSession | null,
  selectedCardId: string | null,
) {
  const [state, dispatch] = useReducer(cardTransactionReducer, initialCardTransactionState);
  const [filter, setFilter] = useState<CardTransactionFilter>("ALL");
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const filterRef = useRef<CardTransactionFilter>(filter);
  filterRef.current = filter;
  const status = cardTransactionStatus(filter);
  const scopeKey = cardTransactionScopeKey(session, selectedCardId, filter);
  const scopeReady = state.scopeKey === scopeKey;
  const view = cardTransactionViewForScope(state, scopeKey);
  const refreshInputRef = useRef<CardHistoryRefreshInput | null>(null);
  refreshInputRef.current =
    session && selectedCardId && scopeKey && view.scopeReady && !view.loading
      ? { scopeKey, session, selectedCardId, status }
      : null;

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardTransactionRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!session || !selectedCardId || !requestKey) {
      activeRequest.current = null;
      return () => controller.abort();
    }

    void backendApi
      .cardTransactions(
        session,
        selectedCardId,
        { limit: CARD_TRANSACTION_PAGE_SIZE, status },
        controller.signal,
      )
      .then((page) => {
        if (requestKey) {
          dispatch({ type: "page", requestKey, requestCursor: null, page, append: false });
        }
      })
      .catch(() =>
        requestKey
          ? dispatch({
              type: "failed",
              requestKey,
              message: errorMessage(),
              append: false,
            })
          : undefined,
      )
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        dispatch({ type: "settled", requestKey });
      });

    return () => {
      controller.abort();
      activeRequest.current?.abort();
      activeRequest.current = null;
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [scopeKey, selectedCardId, session, status]);

  const changeFilter = useCallback(
    (nextFilter: unknown) => {
      if (!isCardTransactionFilter(nextFilter)) {
        activeRequest.current?.abort();
        activeRequest.current = null;
        requestSequence.current += 1;
        dispatch({
          type: "reset",
          scopeKey,
          requestKey: null,
          loading: false,
        });
        return;
      }
      if (nextFilter === filterRef.current) return;
      activeRequest.current?.abort();
      activeRequest.current = null;
      requestSequence.current += 1;
      filterRef.current = nextFilter;
      const nextScopeKey = cardTransactionScopeKey(session, selectedCardId, nextFilter);
      dispatch({
        type: "reset",
        scopeKey: nextScopeKey,
        requestKey: null,
        loading: nextScopeKey !== null,
      });
      setFilter(nextFilter);
    },
    [scopeKey, selectedCardId, session],
  );

  const refresh = useCallback(() => {
    const input = refreshInputRef.current;
    if (!input || activeRequest.current !== null) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = ++requestSequence.current;
    const requestKey = cardTransactionRequestKey(input.scopeKey, null, generation);
    dispatch({ type: "refreshing", scopeKey: input.scopeKey, requestKey });

    void backendApi
      .cardTransactions(
        input.session,
        input.selectedCardId,
        { limit: CARD_TRANSACTION_PAGE_SIZE, status: input.status },
        controller.signal,
      )
      .then((page) => dispatch({ type: "refreshed", requestKey, page }))
      .catch(() =>
        dispatch({
          type: "refresh-failed",
          requestKey,
          message: "Card transaction history refresh failed",
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
      !scopeReady ||
      !selectedCardId ||
      !state.nextCursor ||
      state.loading ||
      state.loadingMore ||
      state.refreshing
    ) {
      return;
    }
    if (!scopeKey) return;
    if (activeRequest.current !== null) return;
    const requestCursor = state.nextCursor;
    const generation = ++requestSequence.current;
    const requestKey = cardTransactionRequestKey(scopeKey, requestCursor, generation);
    const controller = new AbortController();
    activeRequest.current = controller;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.cardTransactions(
        session,
        selectedCardId,
        {
          limit: CARD_TRANSACTION_PAGE_SIZE,
          cursor: requestCursor,
          status,
        },
        controller.signal,
      );
      dispatch({ type: "page", requestKey, requestCursor, page, append: true });
    } catch {
      dispatch({ type: "failed", requestKey, message: errorMessage(), append: true });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      dispatch({ type: "settled", requestKey });
    }
  }, [
    session,
    scopeKey,
    scopeReady,
    selectedCardId,
    state.loading,
    state.loadingMore,
    state.nextCursor,
    state.refreshing,
    status,
  ]);

  return {
    ...view,
    loadMore,
    refresh,
    filter,
    changeFilter,
    canRefresh:
      refreshInputRef.current !== null &&
      activeRequest.current === null &&
      !view.refreshing &&
      !view.loadingMore,
  };
}
