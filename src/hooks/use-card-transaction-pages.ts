import { useCallback, useEffect, useReducer, useRef } from "react";
import { CARD_TRANSACTION_PAGE_SIZE, backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "@/lib/card-transaction-state";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Railway Backend is unavailable";
}

export function useCardTransactionPages(
  session: BackendSession | null,
  selectedCardId: string | null,
) {
  const [state, dispatch] = useReducer(cardTransactionReducer, initialCardTransactionState);
  const requestSequence = useRef(0);
  const scopeKey =
    session && selectedCardId
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.environment,
          selectedCardId,
        ])
      : null;
  const scopeReady = state.scopeKey === scopeKey;
  const view = cardTransactionViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardTransactionRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!session || !selectedCardId) return;

    void backendApi
      .cardTransactions(selectedCardId, { limit: CARD_TRANSACTION_PAGE_SIZE })
      .then((page) => {
        if (requestKey) {
          dispatch({ type: "page", requestKey, requestCursor: null, page, append: false });
        }
      })
      .catch((reason) =>
        requestKey
          ? dispatch({
              type: "failed",
              requestKey,
              message: errorMessage(reason),
              append: false,
            })
          : undefined,
      );

    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [scopeKey, selectedCardId, session]);

  const loadMore = useCallback(async () => {
    if (!scopeReady || !selectedCardId || !state.nextCursor || state.loading || state.loadingMore) {
      return;
    }
    if (!scopeKey) return;
    const requestCursor = state.nextCursor;
    const generation = ++requestSequence.current;
    const requestKey = cardTransactionRequestKey(scopeKey, requestCursor, generation);
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.cardTransactions(selectedCardId, {
        limit: CARD_TRANSACTION_PAGE_SIZE,
        cursor: requestCursor,
      });
      dispatch({ type: "page", requestKey, requestCursor, page, append: true });
    } catch (reason) {
      dispatch({ type: "failed", requestKey, message: errorMessage(reason), append: true });
    }
  }, [scopeKey, scopeReady, selectedCardId, state.loading, state.loadingMore, state.nextCursor]);

  return { ...view, loadMore };
}
