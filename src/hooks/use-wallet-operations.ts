import { useCallback, useEffect, useReducer, useRef } from "react";
import { WALLET_OPERATION_PAGE_SIZE, backendApi, type BackendSession } from "@/lib/backend-api";
import {
  initialWalletOperationState,
  walletOperationErrorMessage,
  walletOperationReducer,
  walletOperationRequestKey,
  walletOperationViewForScope,
} from "@/lib/wallet-operation-state";

export function useWalletOperations(session: BackendSession | null) {
  const [state, dispatch] = useReducer(walletOperationReducer, initialWalletOperationState);
  const requestSequence = useRef(0);
  const scopeKey = session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;
  const view = walletOperationViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? walletOperationRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!scopeKey || !requestKey) return;

    void backendApi
      .walletOperations({ limit: WALLET_OPERATION_PAGE_SIZE })
      .then((page) => dispatch({ type: "page", requestKey, page, append: false }))
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestKey,
          message: walletOperationErrorMessage(reason),
          append: false,
        }),
      )
      .finally(() => dispatch({ type: "settled", requestKey }));
    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [scopeKey]);

  const loadMore = useCallback(async () => {
    if (
      state.scopeKey !== scopeKey ||
      !scopeKey ||
      !state.nextCursor ||
      state.loading ||
      state.loadingMore
    )
      return;
    const cursor = state.nextCursor;
    const generation = ++requestSequence.current;
    const requestKey = walletOperationRequestKey(scopeKey, cursor, generation);
    dispatch({ type: "loading-more", requestKey });
    try {
      const page = await backendApi.walletOperations({
        limit: WALLET_OPERATION_PAGE_SIZE,
        cursor,
      });
      dispatch({ type: "page", requestKey, page, append: true });
    } catch (reason) {
      dispatch({
        type: "failed",
        requestKey,
        message: walletOperationErrorMessage(reason),
        append: true,
      });
    } finally {
      dispatch({ type: "settled", requestKey });
    }
  }, [scopeKey, state]);

  return { ...view, loadMore };
}
