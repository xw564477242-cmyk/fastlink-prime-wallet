import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  CARD_LIST_PAGE_SIZE,
  backendApi,
  type BackendSession,
  type WalletCard,
} from "@/lib/backend-api";
import {
  cardListReducer,
  cardListViewForSession,
  initialCardListState,
} from "@/lib/card-list-state";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Railway Backend is unavailable";
}

export function useCardListPages(
  session: BackendSession | null,
  preferredCardId: string | null = null,
) {
  const [state, dispatch] = useReducer(cardListReducer, initialCardListState);
  const requestSequence = useRef(0);
  const preferredCardIdRef = useRef(preferredCardId);
  preferredCardIdRef.current = preferredCardId;

  const sessionKey = session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;
  const scopeReady = state.sessionKey === sessionKey;
  const view = cardListViewForSession(state, sessionKey);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    dispatch({
      type: "reset",
      requestId,
      sessionKey,
      preferredCardId: preferredCardIdRef.current,
      loading: session !== null,
    });
    if (!session) return;

    void backendApi
      .listCards({ limit: CARD_LIST_PAGE_SIZE })
      .then((page) => dispatch({ type: "page", requestId, page, append: false }))
      .catch((reason) =>
        dispatch({ type: "failed", requestId, message: errorMessage(reason), append: false }),
      );

    return () => {
      if (requestSequence.current === requestId) requestSequence.current += 1;
    };
  }, [session, sessionKey]);

  const loadMore = useCallback(async () => {
    if (!scopeReady || !state.nextCursor || state.loading || state.loadingMore) return;
    const requestId = ++requestSequence.current;
    dispatch({ type: "loading-more", requestId });
    try {
      const page = await backendApi.listCards({
        limit: CARD_LIST_PAGE_SIZE,
        cursor: state.nextCursor,
      });
      dispatch({ type: "page", requestId, page, append: true });
    } catch (reason) {
      dispatch({ type: "failed", requestId, message: errorMessage(reason), append: true });
    }
  }, [scopeReady, state.loading, state.loadingMore, state.nextCursor]);

  const selectCard = useCallback(
    (cardId: string) => {
      if (scopeReady) dispatch({ type: "select", sessionKey, cardId });
    },
    [scopeReady, sessionKey],
  );
  const replaceCard = useCallback(
    (card: WalletCard) => {
      if (scopeReady) dispatch({ type: "replace", sessionKey, card });
    },
    [scopeReady, sessionKey],
  );
  const prependCard = useCallback(
    (card: WalletCard) => {
      if (scopeReady) dispatch({ type: "prepend", sessionKey, card });
    },
    [scopeReady, sessionKey],
  );
  const replaceSelectedCard = useCallback(
    (oldCardId: string, card: WalletCard) => {
      if (scopeReady) {
        dispatch({ type: "replace-selected", sessionKey, oldCardId, card });
      }
    },
    [scopeReady, sessionKey],
  );
  const invalidate = useCallback(
    (message: string) => {
      if (!scopeReady) return;
      const requestId = ++requestSequence.current;
      dispatch({ type: "invalidate", sessionKey, requestId, message });
    },
    [scopeReady, sessionKey],
  );

  return {
    ...view,
    loadMore,
    selectCard,
    replaceCard,
    prependCard,
    replaceSelectedCard,
    invalidate,
  };
}
