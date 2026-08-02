import {
  backendRuntime,
  buildCardActivationRequest,
  cardActivationSessionAllowed,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";

export type CardActivationGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
  retry: CardActivationRetry | null;
  blocked: boolean;
};

export type CardActivationRetry = Readonly<{
  scopeKey: string;
  idempotencyKey: string;
}>;

export type CardActivationTicket = Readonly<{
  scopeKey: string;
  generation: number;
  idempotencyKey: string;
  requestKey: string;
  retry: boolean;
}>;

export type CardActivationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  retryPending: boolean;
  conflictPending: boolean;
};

export const initialCardActivationState: CardActivationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  retryPending: false,
  conflictPending: false,
};

export function cardActivationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  runtimeApiUrl: string,
  card: WalletCard | undefined,
  sessionGeneration = 0,
  cardGeneration = 0,
): string | null {
  if (
    !card ||
    !cardActivationSessionAllowed(session, runtimeEnvironment, runtimeApiUrl) ||
    card.status !== "pending"
  ) {
    return null;
  }
  try {
    buildCardActivationRequest(card, "a0000000-0000-4000-8000-000000000000");
  } catch {
    return null;
  }
  return JSON.stringify([
    sessionGeneration,
    cardGeneration,
    session!.actorId,
    session!.expiresAt,
    session!.tenantId,
    session!.customerId,
    session!.environment,
    runtimeEnvironment,
    runtimeApiUrl,
    card.cardId,
    card.type,
    card.status,
    card.last4,
    card.expiry,
    card.expiryMonth ?? null,
    card.expiryYear ?? null,
    card.currency,
    card.alias ?? null,
    card.availableBalanceMinor ?? null,
    card.createdAt ?? null,
    card.capabilities.freeze,
    card.capabilities.unfreeze,
    card.capabilities.replace,
    card.capabilities.renew,
    card.capabilities.updateLimits,
  ]);
}

export function currentCardActivationScopeKey(
  session: BackendSession | null,
  card: WalletCard | undefined,
  sessionGeneration = 0,
  cardGeneration = 0,
): string | null {
  return cardActivationScopeKey(
    session,
    backendRuntime.error === null ? backendRuntime.environment : undefined,
    backendRuntime.error === null ? backendRuntime.apiUrl : "",
    card,
    sessionGeneration,
    cardGeneration,
  );
}

export function createCardActivationGate(scopeKey: string | null): CardActivationGate {
  return { scopeKey, generation: 0, activeRequestKey: null, retry: null, blocked: false };
}

export function syncCardActivationScope(
  gate: CardActivationGate,
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

export function invalidateCardActivationGate(gate: CardActivationGate): void {
  gate.scopeKey = null;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retry = null;
  gate.blocked = true;
}

export function beginCardActivation(
  gate: CardActivationGate,
  scopeKey: string,
  keyFactory: () => string = () => {
    const key = globalThis.crypto?.randomUUID?.();
    if (!key) throw new Error("Secure idempotency generation is unavailable");
    return key;
  },
): CardActivationTicket | null {
  syncCardActivationScope(gate, scopeKey);
  if (gate.activeRequestKey !== null || gate.blocked) return null;
  const retry = gate.retry;
  if (retry && retry.scopeKey !== scopeKey) {
    gate.retry = null;
    return null;
  }
  const idempotencyKey = retry
    ? retry.idempotencyKey
    : validateVirtualCardIdempotencyKey(keyFactory());
  gate.retry = null;
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return Object.freeze({
    scopeKey,
    generation: gate.generation,
    idempotencyKey,
    requestKey,
    retry: retry !== null,
  });
}

export function cardActivationFailureIsAmbiguous(reason: unknown): boolean {
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

export function cardActivationFailureIsExplicit401(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(reason, "status");
    return Boolean(descriptor && "value" in descriptor && descriptor.value === 401);
  } catch {
    return false;
  }
}

export function acceptsCardActivationCompletion(
  gate: CardActivationGate,
  ticket: CardActivationTicket,
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

export function retainCardActivationRetry(
  gate: CardActivationGate,
  ticket: CardActivationTicket,
  currentScopeKey: string | null,
): boolean {
  if (ticket.retry || !acceptsCardActivationCompletion(gate, ticket, currentScopeKey)) {
    return false;
  }
  gate.retry = Object.freeze({
    scopeKey: ticket.scopeKey,
    idempotencyKey: ticket.idempotencyKey,
  });
  return true;
}

export function clearCardActivationRetry(gate: CardActivationGate): void {
  gate.retry = null;
}

export function blockCardActivation(
  gate: CardActivationGate,
  ticket: CardActivationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardActivationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.retry = null;
  gate.blocked = true;
  return true;
}

export function settleCardActivation(
  gate: CardActivationGate,
  ticket: CardActivationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardActivationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type CardActivationAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "retryable"; requestKey: string; message: string }
  | { type: "conflicted"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardActivationReducer(
  state: CardActivationState,
  action: CardActivationAction,
): CardActivationState {
  switch (action.type) {
    case "reset":
      return { ...initialCardActivationState, scopeKey: action.scopeKey };
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

export function cardActivationView(
  state: CardActivationState,
  scopeKey: string | null,
): CardActivationState {
  return state.scopeKey === scopeKey ? state : { ...initialCardActivationState, scopeKey };
}
