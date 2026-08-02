import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  CARD_TIMELINE_PAGE_SIZE,
  backendApi,
  backendRuntime,
  cardTimelineSessionReadAllowed,
  type BackendSession,
} from "@/lib/backend-api";
import {
  cardTimelineReducer,
  cardTimelineRequestKey,
  cardTimelineViewForScope,
  initialCardTimelineState,
} from "@/lib/card-timeline-state";

type TimelineRefreshInput = {
  scopeKey: string;
  session: BackendSession;
  selectedCardId: string;
};

function timelineScopeKey(
  session: BackendSession | null,
  selectedCardId: string | null,
  now = Date.now(),
): string | null {
  if (
    !session ||
    !selectedCardId ||
    !cardTimelineSessionReadAllowed(session, backendRuntime.environment, backendRuntime.apiUrl, now)
  ) {
    return null;
  }
  return JSON.stringify([
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    selectedCardId,
  ]);
}

function errorMessage(): string {
  return "Card lifecycle timeline is unavailable";
}

export function useCardTimelinePages(
  session: BackendSession | null,
  selectedCardId: string | null,
) {
  const [state, dispatch] = useReducer(cardTimelineReducer, initialCardTimelineState);
  const [expiryTick, wakeAtExpiry] = useReducer((value: number) => value + 1, 0);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
      requestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    if (typeof session?.expiresAt !== "string") return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timeout = globalThis.setTimeout(wakeAtExpiry, Math.min(remaining + 1, 2_147_000_000));
    return () => globalThis.clearTimeout(timeout);
  }, [expiryTick, session?.expiresAt]);

  const scopeKey = timelineScopeKey(session, selectedCardId);
  const view = cardTimelineViewForScope(state, scopeKey);
  const refreshInput = useRef<TimelineRefreshInput | null>(null);
  refreshInput.current =
    session && selectedCardId && scopeKey && view.scopeReady && !view.loading
      ? { session, selectedCardId, scopeKey }
      : null;

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardTimelineRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!session || !selectedCardId || !requestKey) {
      activeRequest.current = null;
      return () => controller.abort();
    }

    void backendApi
      .cardTimeline(session, selectedCardId, { limit: CARD_TIMELINE_PAGE_SIZE }, controller.signal)
      .then((page) => {
        if (mounted.current) {
          dispatch({ type: "page", requestKey, requestCursor: null, page, append: false });
        }
      })
      .catch(() => {
        if (mounted.current) {
          dispatch({ type: "failed", requestKey, message: errorMessage(), append: false });
        }
      })
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        if (mounted.current) dispatch({ type: "settled", requestKey });
      });

    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [expiryTick, scopeKey, selectedCardId, session]);

  const refresh = useCallback(() => {
    const input = refreshInput.current;
    if (!input || activeRequest.current !== null) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestKey = cardTimelineRequestKey(input.scopeKey, null, ++requestSequence.current);
    dispatch({ type: "refreshing", scopeKey: input.scopeKey, requestKey });
    void backendApi
      .cardTimeline(
        input.session,
        input.selectedCardId,
        { limit: CARD_TIMELINE_PAGE_SIZE },
        controller.signal,
      )
      .then((page) => {
        if (mounted.current) dispatch({ type: "refreshed", requestKey, page });
      })
      .catch(() => {
        if (mounted.current) {
          dispatch({
            type: "refresh-failed",
            requestKey,
            message: "Card lifecycle timeline refresh failed",
          });
        }
      })
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null;
        if (mounted.current) dispatch({ type: "settled", requestKey });
      });
  }, []);

  const loadMore = useCallback(async () => {
    if (
      !session ||
      !selectedCardId ||
      !scopeKey ||
      !view.scopeReady ||
      !state.nextCursor ||
      state.loading ||
      state.loadingMore ||
      state.refreshing ||
      activeRequest.current !== null
    ) {
      return;
    }
    const requestCursor = state.nextCursor;
    const requestKey = cardTimelineRequestKey(scopeKey, requestCursor, ++requestSequence.current);
    const controller = new AbortController();
    activeRequest.current = controller;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.cardTimeline(
        session,
        selectedCardId,
        { limit: CARD_TIMELINE_PAGE_SIZE, cursor: requestCursor },
        controller.signal,
      );
      if (mounted.current) {
        dispatch({ type: "page", requestKey, requestCursor, page, append: true });
      }
    } catch {
      if (mounted.current) {
        dispatch({ type: "failed", requestKey, message: errorMessage(), append: true });
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (mounted.current) dispatch({ type: "settled", requestKey });
    }
  }, [scopeKey, selectedCardId, session, state, view.scopeReady]);

  return {
    ...view,
    refresh,
    loadMore,
    canRefresh:
      refreshInput.current !== null &&
      activeRequest.current === null &&
      !view.refreshing &&
      !view.loadingMore,
  };
}
