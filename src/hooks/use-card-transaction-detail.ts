import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backendApi,
  type BackendSession,
  type CardTransactionFilter,
  type WalletCardTransaction,
} from "@/lib/backend-api";
import {
  cardTransactionDetailErrorMessage,
  cardTransactionDetailReducer,
  cardTransactionDetailRequestKey,
  cardTransactionDetailScopeKey,
  cardTransactionDetailViewForScope,
  initialCardTransactionDetailState,
} from "@/lib/card-transaction-detail-state";

type DetailRequestInput = {
  scopeKey: string;
  session: BackendSession;
  cardId: string;
  selectedTransaction: WalletCardTransaction;
};

type ActiveDetailRequest = {
  controller: AbortController;
  requestKey: string;
};

export function useCardTransactionDetail(
  session: BackendSession | null,
  cardId: string | null,
  filter: CardTransactionFilter,
  selectedTransaction: WalletCardTransaction | null,
  historyScopeKey: string | null,
) {
  const [state, dispatch] = useReducer(
    cardTransactionDetailReducer,
    initialCardTransactionDetailState,
  );
  const generationRef = useRef(0);
  const activeRequestRef = useRef<ActiveDetailRequest | null>(null);
  const scopeKey = cardTransactionDetailScopeKey(
    session,
    cardId,
    filter,
    selectedTransaction,
    historyScopeKey,
  );
  const inputRef = useRef<DetailRequestInput | null>(null);
  inputRef.current =
    scopeKey && session && cardId && selectedTransaction
      ? { scopeKey, session, cardId, selectedTransaction }
      : null;
  const view = cardTransactionDetailViewForScope(state, scopeKey);

  const refresh = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++generationRef.current;
    const requestKey = cardTransactionDetailRequestKey(input.scopeKey, generation);
    activeRequestRef.current = { controller, requestKey };
    dispatch({ type: "begin", scopeKey: input.scopeKey, requestKey });

    const isCurrent = () =>
      activeRequestRef.current?.controller === controller &&
      activeRequestRef.current.requestKey === requestKey;

    void backendApi
      .cardTransactionDetail(
        input.session,
        {
          cardId: input.cardId,
          transactionId: input.selectedTransaction.id,
          currency: input.selectedTransaction.currency,
          occurredAt: input.selectedTransaction.timestamp,
        },
        controller.signal,
      )
      .then((detail) => {
        if (isCurrent()) dispatch({ type: "loaded", requestKey, detail });
      })
      .catch((reason) => {
        if (isCurrent()) {
          dispatch({
            type: "failed",
            requestKey,
            message: cardTransactionDetailErrorMessage(reason),
          });
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        activeRequestRef.current = null;
        dispatch({ type: "settled", requestKey });
      });
  }, []);

  useEffect(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    generationRef.current += 1;
    dispatch({ type: "reset", scopeKey });
    return () => {
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;
      generationRef.current += 1;
    };
  }, [scopeKey]);

  return {
    ...view,
    refresh,
    canRefresh: scopeKey !== null && view.scopeReady,
  };
}
