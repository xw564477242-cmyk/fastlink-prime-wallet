import type { WalletCard, WalletCardPage } from "./backend-api";

export type CardListState = {
  sessionKey: string | null;
  requestId: number;
  cards: WalletCard[];
  nextCursor: string | null;
  activeId: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export const initialCardListState: CardListState = {
  sessionKey: null,
  requestId: 0,
  cards: [],
  nextCursor: null,
  activeId: null,
  loading: false,
  loadingMore: false,
  error: null,
};

export type CardListAction =
  | {
      type: "reset";
      requestId: number;
      sessionKey: string | null;
      preferredCardId: string | null;
      loading: boolean;
    }
  | { type: "loading-more"; requestId: number }
  | { type: "page"; requestId: number; page: WalletCardPage; append: boolean }
  | { type: "failed"; requestId: number; message: string; append: boolean }
  | { type: "select"; cardId: string }
  | { type: "replace"; card: WalletCard }
  | { type: "prepend"; card: WalletCard }
  | { type: "invalidate"; requestId: number; message: string };

function mergeCards(current: WalletCard[], incoming: WalletCard[]): WalletCard[] {
  const cards = new Map(current.map((card) => [card.cardId, card]));
  for (const card of incoming) cards.set(card.cardId, card);
  return [...cards.values()];
}

export function cardListReducer(state: CardListState, action: CardListAction): CardListState {
  switch (action.type) {
    case "reset":
      return {
        sessionKey: action.sessionKey,
        requestId: action.requestId,
        cards: [],
        nextCursor: null,
        activeId: action.preferredCardId,
        loading: action.loading,
        loadingMore: false,
        error: null,
      };
    case "loading-more":
      return {
        ...state,
        requestId: action.requestId,
        loadingMore: true,
        error: null,
      };
    case "page": {
      if (action.requestId !== state.requestId) return state;
      const cards = action.append ? mergeCards(state.cards, action.page.cards) : action.page.cards;
      const activeId = cards.some((card) => card.cardId === state.activeId)
        ? state.activeId
        : (cards[0]?.cardId ?? null);
      return {
        ...state,
        cards,
        nextCursor: action.page.nextCursor,
        activeId,
        loading: false,
        loadingMore: false,
        error: null,
      };
    }
    case "failed":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        cards: action.append ? state.cards : [],
        nextCursor: action.append ? state.nextCursor : null,
        activeId: action.append ? state.activeId : null,
        loading: false,
        loadingMore: false,
        error: action.message,
      };
    case "select":
      return state.cards.some((card) => card.cardId === action.cardId)
        ? { ...state, activeId: action.cardId }
        : state;
    case "replace":
      return {
        ...state,
        cards: state.cards.map((card) => (card.cardId === action.card.cardId ? action.card : card)),
      };
    case "prepend":
      return {
        ...state,
        cards: [action.card, ...state.cards.filter((card) => card.cardId !== action.card.cardId)],
        activeId: action.card.cardId,
      };
    case "invalidate":
      return {
        ...state,
        requestId: action.requestId,
        cards: [],
        nextCursor: null,
        activeId: null,
        loading: false,
        loadingMore: false,
        error: action.message,
      };
  }
}
