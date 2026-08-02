import {
  buildCardRenewRequest,
  isVirtualCardCreateEnvironment,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";

export type CardRenewGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
  blocked: boolean;
};

export type CardRenewTicket = Readonly<{
  scopeKey: string;
  generation: number;
  idempotencyKey: string;
  requestKey: string;
}>;

export type CardRenewState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  conflictPending: boolean;
  error: string | null;
  renewedCard: WalletCard | null;
};

export const initialCardRenewState: CardRenewState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  conflictPending: false,
  error: null,
  renewedCard: null,
};

export function cardRenewScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  card: WalletCard | undefined,
  sessionGeneration = 0,
  cardGeneration = 0,
  runtimeApiUrl = "/api",
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    runtimeApiUrl !== "/api" ||
    !Number.isSafeInteger(sessionGeneration) ||
    sessionGeneration < 0 ||
    !Number.isSafeInteger(cardGeneration) ||
    cardGeneration < 0 ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string" ||
    !card ||
    (card.status !== "active" && card.status !== "frozen") ||
    card.capabilities.renew !== true ||
    !/^[A-Za-z0-9._:-]{2,128}$/.test(card.cardId) ||
    !Number.isInteger(card.expiryMonth) ||
    card.expiryMonth! < 1 ||
    card.expiryMonth! > 12 ||
    !Number.isInteger(card.expiryYear) ||
    card.expiryYear! < 2000 ||
    card.expiryYear! > 9999
  ) {
    return null;
  }
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  try {
    buildCardRenewRequest(card, "a0000000-0000-4000-8000-000000000000");
  } catch {
    return null;
  }
  return JSON.stringify([
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
    runtimeApiUrl,
    sessionGeneration,
    cardGeneration,
    card.cardId,
    card.type,
    card.status,
    card.last4,
    card.expiry,
    card.expiryYear,
    card.expiryMonth,
    card.currency,
    card.alias ?? null,
    card.balance,
    card.availableBalanceMinor ?? null,
    card.createdAt ?? null,
    card.capabilities.freeze,
    card.capabilities.unfreeze,
    card.capabilities.replace,
    card.capabilities.renew,
    card.capabilities.updateLimits,
  ]);
}

export function cardRenewView(state: CardRenewState, scopeKey: string | null): CardRenewState {
  return state.scopeKey === scopeKey ? state : { ...initialCardRenewState, scopeKey };
}

export function createCardRenewGate(scopeKey: string | null): CardRenewGate {
  return { scopeKey, generation: 0, activeRequestKey: null, blocked: false };
}

export function syncCardRenewScope(gate: CardRenewGate, scopeKey: string | null): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.blocked = false;
}

function newCardRenewIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error("Secure idempotency generation is unavailable");
  return validateVirtualCardIdempotencyKey(key);
}

export function beginCardRenew(
  gate: CardRenewGate,
  scopeKey: string,
  keyFactory: () => string = newCardRenewIdempotencyKey,
): CardRenewTicket | null {
  syncCardRenewScope(gate, scopeKey);
  if (gate.activeRequestKey !== null || gate.blocked) return null;
  const idempotencyKey = validateVirtualCardIdempotencyKey(keyFactory());
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, idempotencyKey, requestKey };
}

export function blockCardRenew(
  gate: CardRenewGate,
  ticket: CardRenewTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardRenewCompletion(gate, ticket, currentScopeKey)) return false;
  gate.blocked = true;
  return true;
}

export function acceptsCardRenewCompletion(
  gate: CardRenewGate,
  ticket: CardRenewTicket,
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

export function settleCardRenew(
  gate: CardRenewGate,
  ticket: CardRenewTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardRenewCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type CardRenewAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "succeeded"; requestKey: string; card: WalletCard }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "conflicted"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardRenewReducer(state: CardRenewState, action: CardRenewAction): CardRenewState {
  switch (action.type) {
    case "reset":
      return { ...initialCardRenewState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        conflictPending: false,
        error: null,
        renewedCard: null,
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, renewedCard: action.card }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, renewedCard: null }
        : state;
    case "conflicted":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, renewedCard: null, conflictPending: true }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}
