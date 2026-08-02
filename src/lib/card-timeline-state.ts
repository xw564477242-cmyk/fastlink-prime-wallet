import {
  CARD_TIMELINE_MAX_PAGES,
  CARD_TIMELINE_PAGE_SIZE,
  type WalletCardTimelineEvent,
  type WalletCardTimelinePage,
} from "./backend-api";

export const CARD_TIMELINE_PAGINATION_ERROR =
  "Backend returned inconsistent Card timeline pagination";

export type CardTimelineState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  events: readonly WalletCardTimelineEvent[];
  nextCursor: string | null;
  seenCursors: readonly string[];
  pageCount: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
};

export const initialCardTimelineState: CardTimelineState = {
  scopeKey: null,
  activeRequestKey: null,
  events: [],
  nextCursor: null,
  seenCursors: [],
  pageCount: 0,
  loading: false,
  loadingMore: false,
  refreshing: false,
  error: null,
  refreshError: null,
};

export function cardTimelineRequestKey(
  scopeKey: string,
  requestCursor: string | null,
  generation: number,
): string {
  return JSON.stringify([scopeKey, requestCursor, generation]);
}

export function cardTimelineViewForScope(
  state: CardTimelineState,
  scopeKey: string | null,
): CardTimelineState & { scopeReady: boolean } {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return {
    ...initialCardTimelineState,
    scopeKey,
    loading: scopeKey !== null,
    scopeReady: false,
  };
}

export type CardTimelineAction =
  | { type: "reset"; scopeKey: string | null; requestKey: string | null; loading: boolean }
  | { type: "loading-more"; requestKey: string; requestCursor: string }
  | { type: "refreshing"; scopeKey: string; requestKey: string }
  | { type: "refreshed"; requestKey: string; page: WalletCardTimelinePage }
  | { type: "refresh-failed"; requestKey: string; message: string; clearSnapshot?: boolean }
  | {
      type: "page";
      requestKey: string;
      requestCursor: string | null;
      page: WalletCardTimelinePage;
      append: boolean;
    }
  | {
      type: "failed";
      requestKey: string;
      message: string;
      append: boolean;
      clearSnapshot?: boolean;
    }
  | { type: "settled"; requestKey: string };

function hasDuplicateIds(events: readonly WalletCardTimelineEvent[]): boolean {
  return new Set(events.map((event) => event.id)).size !== events.length;
}

function continuationIsOrdered(
  existing: readonly WalletCardTimelineEvent[],
  next: readonly WalletCardTimelineEvent[],
): boolean {
  const previous = existing.at(-1);
  const following = next[0];
  return (
    !previous || !following || Date.parse(previous.occurredAt) >= Date.parse(following.occurredAt)
  );
}

function paginationFailure(state: CardTimelineState): CardTimelineState {
  return {
    ...state,
    nextCursor: null,
    loading: false,
    loadingMore: false,
    refreshing: false,
    error: CARD_TIMELINE_PAGINATION_ERROR,
  };
}

function verifiedFirstPage(
  state: CardTimelineState,
  page: WalletCardTimelinePage,
): CardTimelineState {
  if (hasDuplicateIds(page.events)) {
    return { ...state, refreshing: false, refreshError: CARD_TIMELINE_PAGINATION_ERROR };
  }
  return {
    ...state,
    events: page.events,
    nextCursor: page.nextCursor,
    seenCursors: page.nextCursor === null ? [] : [page.nextCursor],
    pageCount: 1,
    loading: false,
    loadingMore: false,
    refreshing: false,
    error: null,
    refreshError: null,
  };
}

export function cardTimelineReducer(
  state: CardTimelineState,
  action: CardTimelineAction,
): CardTimelineState {
  switch (action.type) {
    case "reset":
      return {
        ...initialCardTimelineState,
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        loading: action.loading,
      };
    case "loading-more":
      if (action.requestCursor !== state.nextCursor || state.pageCount >= CARD_TIMELINE_MAX_PAGES) {
        return paginationFailure(state);
      }
      return {
        ...state,
        activeRequestKey: action.requestKey,
        loadingMore: true,
        error: null,
        refreshError: null,
      };
    case "refreshing":
      if (action.scopeKey !== state.scopeKey || state.loading || state.loadingMore) return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        refreshing: true,
        error: null,
        refreshError: null,
      };
    case "refreshed":
      return action.requestKey === state.activeRequestKey
        ? verifiedFirstPage(state, action.page)
        : state;
    case "refresh-failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      return action.clearSnapshot
        ? {
            ...initialCardTimelineState,
            scopeKey: state.scopeKey,
            activeRequestKey: state.activeRequestKey,
            refreshError: action.message,
          }
        : { ...state, refreshing: false, refreshError: action.message };
    case "page": {
      if (action.requestKey !== state.activeRequestKey) return state;
      if (!action.append) return verifiedFirstPage(state, action.page);
      if (
        action.requestCursor !== state.nextCursor ||
        state.pageCount >= CARD_TIMELINE_MAX_PAGES ||
        hasDuplicateIds(action.page.events) ||
        !continuationIsOrdered(state.events, action.page.events)
      ) {
        return paginationFailure(state);
      }
      const currentIds = new Set(state.events.map((event) => event.id));
      if (action.page.events.some((event) => currentIds.has(event.id))) {
        return paginationFailure(state);
      }
      if (
        action.page.nextCursor !== null &&
        (action.page.nextCursor === action.requestCursor ||
          state.seenCursors.includes(action.page.nextCursor))
      ) {
        return paginationFailure(state);
      }
      const pageCount = state.pageCount + 1;
      const nextCursor = pageCount >= CARD_TIMELINE_MAX_PAGES ? null : action.page.nextCursor;
      const events = [...state.events, ...action.page.events];
      if (events.length > CARD_TIMELINE_PAGE_SIZE * CARD_TIMELINE_MAX_PAGES) {
        return paginationFailure(state);
      }
      return {
        ...state,
        events,
        nextCursor,
        seenCursors:
          action.page.nextCursor === null
            ? state.seenCursors
            : [...state.seenCursors, action.page.nextCursor],
        pageCount,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: null,
        refreshError: null,
      };
    }
    case "failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      if (action.clearSnapshot) {
        return {
          ...initialCardTimelineState,
          scopeKey: state.scopeKey,
          activeRequestKey: state.activeRequestKey,
          error: action.message,
        };
      }
      return action.append
        ? {
            ...state,
            nextCursor: null,
            loadingMore: false,
            error: action.message,
          }
        : {
            ...initialCardTimelineState,
            scopeKey: state.scopeKey,
            activeRequestKey: state.activeRequestKey,
            error: action.message,
          };
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, loading: false, loadingMore: false, refreshing: false }
        : state;
  }
}
