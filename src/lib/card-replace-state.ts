import {
  isCardReplacementReason,
  isVirtualCardCreateEnvironment,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type CardReplacementReason,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";

export type CardReplaceGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
};

export type CardReplaceTicket = Readonly<{
  scopeKey: string;
  generation: number;
  reason: CardReplacementReason;
  idempotencyKey: string;
  requestKey: string;
}>;

export type CardReplaceState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  replacementCard: WalletCard | null;
};

export const initialCardReplaceState: CardReplaceState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  replacementCard: null,
};

export function cardReplaceScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  card: WalletCard | undefined,
  reason: CardReplacementReason | undefined,
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    !card ||
    !isCardReplacementReason(reason) ||
    (card.type !== "virtual" && card.type !== "physical") ||
    (card.status !== "active" && card.status !== "frozen") ||
    card.capabilities.replace !== true ||
    !/^[A-Za-z0-9._:-]{2,128}$/.test(card.cardId) ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency) ||
    !Number.isInteger(card.expiryMonth) ||
    card.expiryMonth! < 1 ||
    card.expiryMonth! > 12 ||
    !Number.isInteger(card.expiryYear) ||
    card.expiryYear! < 2000 ||
    card.expiryYear! > 9999
  ) {
    return null;
  }
  return JSON.stringify([
    session.actorId,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
    reason,
    card.cardId,
    card.type,
    card.status,
    card.last4,
    card.expiryYear,
    card.expiryMonth,
    card.currency,
    card.alias ?? null,
    card.createdAt ?? null,
  ]);
}

export function cardReplaceView(
  state: CardReplaceState,
  scopeKey: string | null,
): CardReplaceState {
  return state.scopeKey === scopeKey ? state : { ...initialCardReplaceState, scopeKey };
}

export function createCardReplaceGate(scopeKey: string | null): CardReplaceGate {
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncCardReplaceScope(gate: CardReplaceGate, scopeKey: string | null): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

function newCardReplaceIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error("Secure idempotency generation is unavailable");
  return validateVirtualCardIdempotencyKey(key);
}

export function beginCardReplace(
  gate: CardReplaceGate,
  scopeKey: string,
  reason: CardReplacementReason,
  keyFactory: () => string = newCardReplaceIdempotencyKey,
): CardReplaceTicket | null {
  syncCardReplaceScope(gate, scopeKey);
  if (gate.activeRequestKey !== null) return null;
  if (!isCardReplacementReason(reason)) throw new Error("Invalid Card replacement reason");
  const idempotencyKey = validateVirtualCardIdempotencyKey(keyFactory());
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, reason, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, reason, idempotencyKey, requestKey };
}

export function acceptsCardReplaceCompletion(
  gate: CardReplaceGate,
  ticket: CardReplaceTicket,
  currentScopeKey: string | null,
): boolean {
  return (
    currentScopeKey !== null &&
    gate.scopeKey === currentScopeKey &&
    ticket.scopeKey === currentScopeKey &&
    gate.generation === ticket.generation &&
    gate.activeRequestKey === ticket.requestKey
  );
}

export function settleCardReplace(
  gate: CardReplaceGate,
  ticket: CardReplaceTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardReplaceCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type CardReplaceAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "succeeded"; requestKey: string; card: WalletCard }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardReplaceReducer(
  state: CardReplaceState,
  action: CardReplaceAction,
): CardReplaceState {
  switch (action.type) {
    case "reset":
      return { ...initialCardReplaceState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        replacementCard: null,
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, replacementCard: action.card }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, replacementCard: null }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}
