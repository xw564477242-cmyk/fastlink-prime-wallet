import { useEffect, useReducer, useRef } from "react";
import { backendApi, type BackendSession } from "@/lib/backend-api";
import {
  initialWalletOperationDetailState,
  walletOperationDetailErrorMessage,
  walletOperationDetailReducer,
  walletOperationDetailRequestKey,
  walletOperationDetailViewForScope,
} from "@/lib/wallet-operation-detail-state";

export function useWalletOperationDetail(
  session: BackendSession | null,
  operationId: string | null,
) {
  const [state, dispatch] = useReducer(
    walletOperationDetailReducer,
    initialWalletOperationDetailState,
  );
  const requestSequence = useRef(0);
  const scopeKey =
    session && operationId
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.environment,
          operationId,
        ])
      : null;
  const view = walletOperationDetailViewForScope(state, scopeKey);

  useEffect(() => {
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? walletOperationDetailRequestKey(scopeKey, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!operationId || !requestKey) return;

    void backendApi
      .walletOperationDetail({ operationId })
      .then((detail) => dispatch({ type: "loaded", requestKey, detail }))
      .catch((reason) =>
        dispatch({
          type: "failed",
          requestKey,
          message: walletOperationDetailErrorMessage(reason),
        }),
      )
      .finally(() => dispatch({ type: "settled", requestKey }));

    return () => {
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [operationId, scopeKey]);

  return view;
}
