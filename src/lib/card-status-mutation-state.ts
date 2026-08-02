import {
  buildCardStatusMutationRequest,
  isVirtualCardCreateEnvironment,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type CardStatusMutationAction,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";

export type CardStatusMutationGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
  retry: CardStatusMutationRetry | null;
  blocked: boolean;
};

export type CardStatusMutationRetry = Readonly<{
  scopeKey: string;
  action: CardStatusMutationAction;
  idempotencyKey: string;
}>;

export type CardStatusMutationTicket = Readonly<{
  scopeKey: string;
  generation: number;
  action: CardStatusMutationAction;
  idempotencyKey: string;
  requestKey: string;
  retry: boolean;
}>;

export type CardStatusMutationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  retryPending: boolean;
  conflictPending: boolean;
};

export const initialCardStatusMutationState: CardStatusMutationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  retryPending: false,
  conflictPending: false,
};

export function cardStatusMutationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  card: WalletCard | undefined,
  action: CardStatusMutationAction,
  sessionGeneration = 0,
  cardGeneration = 0,
  runtimeApiUrl = "/api",
): string | null {
  if (
    !session ||
    runtimeApiUrl !== "/api" ||
    !runtimeEnvironment ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string" ||
    ![session.actorId, session.tenantId, session.customerId].every(
      (value) => typeof value === "string" && value.length >= 2 && value.length <= 512,
    ) ||
    !card
  ) {
    return null;
  }
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  try {
    buildCardStatusMutationRequest(card, action, "a0000000-0000-4000-8000-000000000000");
  } catch {
    return null;
  }
  return JSON.stringify([
    sessionGeneration,
    cardGeneration,
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
    runtimeApiUrl,
    action,
    card.cardId,
    card.type,
    card.status,
    card.last4,
    card.expiry,
    card.expiryMonth ?? null,
    card.expiryYear ?? null,
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

export function createCardStatusMutationGate(scopeKey: string | null): CardStatusMutationGate {
  return { scopeKey, generation: 0, activeRequestKey: null, retry: null, blocked: false };
}

export function syncCardStatusMutationScope(
  gate: CardStatusMutationGate,
  scopeKey: string | null,
): boolean {
  if (gate.scopeKey === scopeKey) return false;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retry = null;
  gate.blocked = false;
  return true;
}

export function invalidateCardStatusMutationGate(gate: CardStatusMutationGate): void {
  gate.scopeKey = null;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retry = null;
  gate.blocked = true;
}

export function beginCardStatusMutation(
  gate: CardStatusMutationGate,
  scopeKey: string,
  action: CardStatusMutationAction,
  keyFactory: () => string = () => {
    const key = globalThis.crypto?.randomUUID?.();
    if (!key) throw new Error("Secure idempotency generation is unavailable");
    return key;
  },
): CardStatusMutationTicket | null {
  syncCardStatusMutationScope(gate, scopeKey);
  if (gate.activeRequestKey !== null || gate.blocked) return null;
  const retry = gate.retry;
  if (retry && (retry.scopeKey !== scopeKey || retry.action !== action)) {
    gate.retry = null;
    return null;
  }
  const idempotencyKey = retry
    ? retry.idempotencyKey
    : validateVirtualCardIdempotencyKey(keyFactory());
  gate.retry = null;
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, action, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return {
    scopeKey,
    generation: gate.generation,
    action,
    idempotencyKey,
    requestKey,
    retry: retry !== null,
  };
}

export function cardStatusMutationFailureIsAmbiguous(reason: unknown): boolean {
  if (reason instanceof TypeError) return true;
  if (!reason || typeof reason !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(reason, "status");
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number") {
      return false;
    }
    return (
      descriptor.value === 0 ||
      descriptor.value === 408 ||
      descriptor.value === 409 ||
      (descriptor.value >= 500 && descriptor.value <= 599)
    );
  } catch {
    return false;
  }
}

export function cardStatusMutationFailureIsExplicit401(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(reason, "status");
    return Boolean(descriptor && "value" in descriptor && descriptor.value === 401);
  } catch {
    return false;
  }
}

export function retainCardStatusMutationRetry(
  gate: CardStatusMutationGate,
  ticket: CardStatusMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (ticket.retry || !acceptsCardStatusMutationCompletion(gate, ticket, currentScopeKey))
    return false;
  gate.retry = Object.freeze({
    scopeKey: ticket.scopeKey,
    action: ticket.action,
    idempotencyKey: ticket.idempotencyKey,
  });
  return true;
}

export function clearCardStatusMutationRetry(gate: CardStatusMutationGate): void {
  gate.retry = null;
}

export function blockCardStatusMutation(
  gate: CardStatusMutationGate,
  ticket: CardStatusMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardStatusMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.retry = null;
  gate.blocked = true;
  return true;
}

export function acceptsCardStatusMutationCompletion(
  gate: CardStatusMutationGate,
  ticket: CardStatusMutationTicket,
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

export function settleCardStatusMutation(
  gate: CardStatusMutationGate,
  ticket: CardStatusMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardStatusMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type CardStatusMutationActionState =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "retryable"; requestKey: string; message: string }
  | { type: "conflicted"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardStatusMutationReducer(
  state: CardStatusMutationState,
  action: CardStatusMutationActionState,
): CardStatusMutationState {
  switch (action.type) {
    case "reset":
      return { ...initialCardStatusMutationState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        retryPending: false,
        conflictPending: false,
      };
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, retryPending: false, conflictPending: false }
        : state;
    case "retryable":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, retryPending: true, conflictPending: false }
        : state;
    case "conflicted":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, retryPending: false, conflictPending: true }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}

export function cardStatusMutationView(
  state: CardStatusMutationState,
  scopeKey: string | null,
): CardStatusMutationState {
  return state.scopeKey === scopeKey ? state : { ...initialCardStatusMutationState, scopeKey };
}
