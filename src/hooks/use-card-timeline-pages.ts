import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  BackendApiError,
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

type ActiveTimelineRequest = {
  controller: AbortController;
  input: TimelineRefreshInput;
  requestKey: string;
};

function timelineScopeKey(
  session: BackendSession | null,
  selectedCardId: string | null,
  sessionIdentity: number,
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
    sessionIdentity,
    selectedCardId,
  ]);
}

function errorMessage(): string {
  return "Card lifecycle timeline is unavailable";
}

function authorizationFailureStatus(reason: unknown): 401 | 403 | 404 | null {
  if (!(reason instanceof BackendApiError)) return null;
  return reason.status === 401 || reason.status === 403 || reason.status === 404
    ? reason.status
    : null;
}

export function useCardTimelinePages(
  session: BackendSession | null,
  selectedCardId: string | null,
  invalidateSession?: (expectedSession: BackendSession) => void,
) {
  const [state, dispatch] = useReducer(cardTimelineReducer, initialCardTimelineState);
  const [expiryTick, wakeAtExpiry] = useReducer((value: number) => value + 1, 0);
  const requestSequence = useRef(0);
  const activeRequest = useRef<ActiveTimelineRequest | null>(null);
  const mounted = useRef(false);
  const currentInput = useRef<TimelineRefreshInput | null>(null);
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
    if (typeof session?.expiresAt !== "string") return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timeout = globalThis.setTimeout(wakeAtExpiry, Math.min(remaining + 1, 2_147_000_000));
    return () => globalThis.clearTimeout(timeout);
  }, [expiryTick, session?.expiresAt]);

  const scopeKey = timelineScopeKey(session, selectedCardId, sessionIdentity.current.generation);
  const view = cardTimelineViewForScope(state, scopeKey);
  const refreshInput = useRef<TimelineRefreshInput | null>(null);
  currentInput.current =
    session && selectedCardId && scopeKey ? { session, selectedCardId, scopeKey } : null;
  refreshInput.current =
    session && selectedCardId && scopeKey && view.scopeReady && !view.loading
      ? { session, selectedCardId, scopeKey }
      : null;

  const requestIsCurrent = useCallback(
    (request: ActiveTimelineRequest) =>
      mounted.current &&
      activeRequest.current === request &&
      currentInput.current?.session === request.input.session &&
      currentInput.current.scopeKey === request.input.scopeKey &&
      currentInput.current.selectedCardId === request.input.selectedCardId,
    [],
  );

  useEffect(() => {
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
    const generation = ++requestSequence.current;
    const requestKey = scopeKey ? cardTimelineRequestKey(scopeKey, null, generation) : null;
    dispatch({ type: "reset", scopeKey, requestKey, loading: scopeKey !== null });
    if (!session || !selectedCardId || !scopeKey || !requestKey) {
      return;
    }
    const input = { session, selectedCardId, scopeKey };
    const request: ActiveTimelineRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;

    void backendApi
      .cardTimeline(
        session,
        selectedCardId,
        { limit: CARD_TIMELINE_PAGE_SIZE },
        request.controller.signal,
      )
      .then((page) => {
        if (requestIsCurrent(request)) {
          dispatch({ type: "page", requestKey, requestCursor: null, page, append: false });
        }
      })
      .catch((reason) => {
        if (requestIsCurrent(request)) {
          const status = authorizationFailureStatus(reason);
          dispatch({
            type: "failed",
            requestKey,
            message: errorMessage(),
            append: false,
            clearSnapshot: status !== null,
          });
          if (status === 401) invalidateSessionRef.current?.(session);
        }
      })
      .finally(() => {
        if (activeRequest.current === request) activeRequest.current = null;
        if (mounted.current) dispatch({ type: "settled", requestKey });
      });

    return () => {
      request.controller.abort();
      if (activeRequest.current === request) activeRequest.current = null;
      if (requestSequence.current === generation) requestSequence.current += 1;
    };
  }, [expiryTick, requestIsCurrent, scopeKey, selectedCardId, session]);

  const refresh = useCallback(() => {
    const input = refreshInput.current;
    if (!input || activeRequest.current !== null) return;
    const requestKey = cardTimelineRequestKey(input.scopeKey, null, ++requestSequence.current);
    const request: ActiveTimelineRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;
    dispatch({ type: "refreshing", scopeKey: input.scopeKey, requestKey });
    void backendApi
      .cardTimeline(
        input.session,
        input.selectedCardId,
        { limit: CARD_TIMELINE_PAGE_SIZE },
        request.controller.signal,
      )
      .then((page) => {
        if (requestIsCurrent(request)) dispatch({ type: "refreshed", requestKey, page });
      })
      .catch((reason) => {
        if (requestIsCurrent(request)) {
          const status = authorizationFailureStatus(reason);
          dispatch({
            type: "refresh-failed",
            requestKey,
            message: "Card lifecycle timeline refresh failed",
            clearSnapshot: status !== null,
          });
          if (status === 401) invalidateSessionRef.current?.(input.session);
        }
      })
      .finally(() => {
        if (activeRequest.current === request) activeRequest.current = null;
        if (mounted.current) dispatch({ type: "settled", requestKey });
      });
  }, [requestIsCurrent]);

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
    const input = { session, selectedCardId, scopeKey };
    const request: ActiveTimelineRequest = {
      controller: new AbortController(),
      input,
      requestKey,
    };
    activeRequest.current = request;
    dispatch({ type: "loading-more", requestKey, requestCursor });
    try {
      const page = await backendApi.cardTimeline(
        session,
        selectedCardId,
        { limit: CARD_TIMELINE_PAGE_SIZE, cursor: requestCursor },
        request.controller.signal,
      );
      if (requestIsCurrent(request)) {
        dispatch({ type: "page", requestKey, requestCursor, page, append: true });
      }
    } catch (reason) {
      if (requestIsCurrent(request)) {
        const status = authorizationFailureStatus(reason);
        dispatch({
          type: "failed",
          requestKey,
          message: errorMessage(),
          append: true,
          clearSnapshot: status !== null,
        });
        if (status === 401) invalidateSessionRef.current?.(session);
      }
    } finally {
      if (activeRequest.current === request) activeRequest.current = null;
      if (mounted.current) dispatch({ type: "settled", requestKey });
    }
  }, [requestIsCurrent, scopeKey, selectedCardId, session, state, view.scopeReady]);

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
