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
};

export type CardStatusMutationTicket = Readonly<{
  scopeKey: string;
  generation: number;
  action: CardStatusMutationAction;
  idempotencyKey: string;
  requestKey: string;
}>;

export type CardStatusMutationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
};

export const initialCardStatusMutationState: CardStatusMutationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
};

export function cardStatusMutationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  card: WalletCard | undefined,
  action: CardStatusMutationAction,
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string" ||
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
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
    action,
    card.cardId,
    card.type,
    card.status,
    card.last4,
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

export function createCardStatusMutationGate(scopeKey: string | null): CardStatusMutationGate {
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncCardStatusMutationScope(
  gate: CardStatusMutationGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
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
  if (gate.activeRequestKey !== null) return null;
  const idempotencyKey = validateVirtualCardIdempotencyKey(keyFactory());
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, action, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, action, idempotencyKey, requestKey };
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
      };
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message }
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
