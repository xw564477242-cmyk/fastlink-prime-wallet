import { useCallback, useEffect, useReducer, useRef } from "react";
import { CARD_TRANSACTION_PAGE_SIZE, backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardTransactionReducer,
  cardTransactionRequestKey,
  cardTransactionViewForScope,
  initialCardTransactionState,
} from "@/lib/card-transaction-state";

function errorMessage(): string {
  return "Card transactions are unavailable";
}

export function useCardTransactionPages(
  session: BackendSession | null,
  selectedCardId: string | null,
) {
  const [state, dispatch] = useReducer(cardTransactionReducer, initialCardTransactionState);
  const requestSequence = useRef(0);
  const activePageRequest = useRef<string | null>(null);
  const scopeKey =
    session && selectedCardId
      ? JSON.stringify([
          session.actorId,
          session.expiresAt ?? null,
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
    activePageRequest.current = null;
    const requestKey = scopeKey ? cardTransactionRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!session || !selectedCardId) return;

    void backendApi
      .cardTransactions(session, selectedCardId, { limit: CARD_TRANSACTION_PAGE_SIZE })
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
      .finally(() => (requestKey ? dispatch({ type: "settled", requestKey }) : undefined));

    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [scopeKey, selectedCardId, session]);

  const loadMore = useCallback(async () => {
    if (
      !session ||
      !scopeReady ||
      !selectedCardId ||
      !state.nextCursor ||
      state.loading ||
      state.loadingMore
    ) {
      return;
    }
    if (!scopeKey) return;
    if (activePageRequest.current !== null) return;
    const requestCursor = state.nextCursor;
    const generation = ++requestSequence.current;
    const requestKey = cardTransactionRequestKey(scopeKey, requestCursor, generation);
    activePageRequest.current = requestKey;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.cardTransactions(session, selectedCardId, {
        limit: CARD_TRANSACTION_PAGE_SIZE,
        cursor: requestCursor,
      });
      dispatch({ type: "page", requestKey, requestCursor, page, append: true });
    } catch {
      dispatch({ type: "failed", requestKey, message: errorMessage(), append: true });
    } finally {
      if (activePageRequest.current === requestKey) activePageRequest.current = null;
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
  ]);

  return { ...view, loadMore };
}
