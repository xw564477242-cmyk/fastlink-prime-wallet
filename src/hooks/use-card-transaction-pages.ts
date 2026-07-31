import { useCallback, useEffect, useReducer, useRef } from "react";
import { CARD_TRANSACTION_PAGE_SIZE, backendApi, type BackendSession } from "@/lib/backend-api";
import {
  cardTransactionReducer,
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
    const requestId = ++requestSequence.current;
    dispatch({ type: "reset", scopeKey, requestId, loading: scopeKey !== null });
    if (!session || !selectedCardId) return;

    void backendApi
      .cardTransactions(selectedCardId, { limit: CARD_TRANSACTION_PAGE_SIZE })
      .then((page) => dispatch({ type: "page", requestId, page, append: false }))
      .catch((reason) =>
        dispatch({ type: "failed", requestId, message: errorMessage(reason), append: false }),
      );

    return () => {
      if (requestSequence.current === requestId) requestSequence.current += 1;
    };
  }, [scopeKey, selectedCardId, session]);

  const loadMore = useCallback(async () => {
    if (!scopeReady || !selectedCardId || !state.nextCursor || state.loading || state.loadingMore) {
      return;
    }
    const requestId = ++requestSequence.current;
    dispatch({ type: "loading-more", requestId });
    try {
      const page = await backendApi.cardTransactions(selectedCardId, {
        limit: CARD_TRANSACTION_PAGE_SIZE,
        cursor: state.nextCursor,
      });
      dispatch({ type: "page", requestId, page, append: true });
    } catch (reason) {
      dispatch({ type: "failed", requestId, message: errorMessage(reason), append: true });
    }
  }, [scopeReady, selectedCardId, state.loading, state.loadingMore, state.nextCursor]);

  return { ...view, loadMore };
}
