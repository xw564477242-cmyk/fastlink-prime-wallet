import {
  isVirtualCardCreateEnvironment,
  normalizeCardLimitsResponse,
  normalizeCardLimitsUpdateInput,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type CardLimitsUpdateInput,
  type FastLinkEnvironment,
  type WalletCard,
  type WalletCardLimits,
} from "./backend-api";

export type CardLimitsMutationGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
  retries: Map<string, CardLimitsMutationRetry>;
  blockedRecoveryScopeKeys: Set<string>;
};

export type CardLimitsMutationRetry = Readonly<{
  scopeKey: string;
  recoveryScopeKey: string;
  input: CardLimitsUpdateInput;
  idempotencyKey: string;
}>;

export type CardLimitsMutationTicket = Readonly<{
  scopeKey: string;
  recoveryScopeKey: string;
  generation: number;
  input: CardLimitsUpdateInput;
  idempotencyKey: string;
  requestKey: string;
  retry: boolean;
}>;

export type CardLimitsMutationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  updatedLimits: WalletCardLimits | null;
  retryPending: boolean;
  conflictPending: boolean;
};

export const initialCardLimitsMutationState: CardLimitsMutationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  updatedLimits: null,
  retryPending: false,
  conflictPending: false,
};

function optionalBalanceScopeValue(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^(?:0|-?[1-9]\d{0,18})$/.test(value)) {
    throw new Error("Invalid selected Card balance");
  }
  const amount = BigInt(value);
  if (amount < -9_223_372_036_854_775_808n || amount > 9_223_372_036_854_775_807n) {
    throw new Error("Invalid selected Card balance");
  }
  return value;
}

export function cardLimitsMutationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  card: WalletCard | undefined,
  current: WalletCardLimits | null,
  sessionIdentity = 0,
  cardIdentity = 0,
  limitsIdentity = 0,
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string" ||
    !card ||
    !current ||
    (card.type !== "virtual" && card.type !== "physical") ||
    (card.status !== "active" && card.status !== "frozen" && card.status !== "pending") ||
    card.capabilities.updateLimits !== true ||
    !/^[A-Za-z0-9._:-]{2,128}$/.test(card.cardId) ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency)
  ) {
    return null;
  }
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  let limits: WalletCardLimits;
  let availableBalanceMinor: string | null;
  try {
    limits = normalizeCardLimitsResponse(current, card.cardId);
    availableBalanceMinor = optionalBalanceScopeValue(card.availableBalanceMinor);
  } catch {
    return null;
  }
  return JSON.stringify([
    sessionIdentity,
    cardIdentity,
    limitsIdentity,
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
    card.cardId,
    card.type,
    card.status,
    card.last4,
    card.expiryYear ?? null,
    card.expiryMonth ?? null,
    card.currency,
    card.alias ?? null,
    card.createdAt ?? null,
    availableBalanceMinor,
    limits.singleTransactionMinor,
    limits.dailySpendMinor,
    limits.monthlySpendMinor,
    limits.dailyAtmMinor,
    limits.updatedAt,
  ]);
}

export function cardLimitsMutationView(
  state: CardLimitsMutationState,
  scopeKey: string | null,
): CardLimitsMutationState {
  return state.scopeKey === scopeKey ? state : { ...initialCardLimitsMutationState, scopeKey };
}

export function createCardLimitsMutationGate(scopeKey: string | null): CardLimitsMutationGate {
  return {
    scopeKey,
    generation: 0,
    activeRequestKey: null,
    retries: new Map(),
    blockedRecoveryScopeKeys: new Set(),
  };
}

export function syncCardLimitsMutationScope(
  gate: CardLimitsMutationGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function invalidateCardLimitsMutationGate(gate: CardLimitsMutationGate): void {
  gate.scopeKey = null;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retries.clear();
  gate.blockedRecoveryScopeKeys.clear();
}

function newCardLimitsMutationIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error("Secure idempotency generation is unavailable");
  return validateVirtualCardIdempotencyKey(key);
}

export function beginCardLimitsMutation(
  gate: CardLimitsMutationGate,
  scopeKey: string,
  current: WalletCardLimits,
  input: unknown,
  keyFactory: () => string = newCardLimitsMutationIdempotencyKey,
  recoveryScopeKey = scopeKey,
): CardLimitsMutationTicket | null {
  syncCardLimitsMutationScope(gate, scopeKey);
  if (gate.activeRequestKey !== null || gate.blockedRecoveryScopeKeys.has(recoveryScopeKey)) {
    return null;
  }
  const normalizedInput = normalizeCardLimitsUpdateInput(input, current);
  const pendingRetry = gate.retries.get(recoveryScopeKey) ?? null;
  if (pendingRetry && pendingRetry.scopeKey !== scopeKey) return null;
  const idempotencyKey = pendingRetry
    ? pendingRetry.idempotencyKey
    : validateVirtualCardIdempotencyKey(keyFactory());
  gate.generation += 1;
  const requestKey = JSON.stringify([
    scopeKey,
    recoveryScopeKey,
    normalizedInput,
    idempotencyKey,
    gate.generation,
  ]);
  gate.activeRequestKey = requestKey;
  return {
    scopeKey,
    recoveryScopeKey,
    generation: gate.generation,
    input: normalizedInput,
    idempotencyKey,
    requestKey,
    retry: pendingRetry !== null,
  };
}

export function cardLimitsMutationFailureIsAmbiguous(reason: unknown): boolean {
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

export function cardLimitsMutationFailureIsExplicit401(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(reason, "status");
    return Boolean(descriptor && "value" in descriptor && descriptor.value === 401);
  } catch {
    return false;
  }
}

export function retainCardLimitsMutationRetry(
  gate: CardLimitsMutationGate,
  ticket: CardLimitsMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (ticket.retry || !acceptsCardLimitsMutationCompletion(gate, ticket, currentScopeKey)) {
    return false;
  }
  gate.retries.set(
    ticket.recoveryScopeKey,
    Object.freeze({
      scopeKey: ticket.scopeKey,
      recoveryScopeKey: ticket.recoveryScopeKey,
      input: Object.freeze({ ...ticket.input }),
      idempotencyKey: ticket.idempotencyKey,
    }),
  );
  return true;
}

export function clearCardLimitsMutationRetry(
  gate: CardLimitsMutationGate,
  recoveryScopeKey: string,
): void {
  gate.retries.delete(recoveryScopeKey);
}

export function blockCardLimitsMutation(
  gate: CardLimitsMutationGate,
  ticket: CardLimitsMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardLimitsMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.retries.delete(ticket.recoveryScopeKey);
  gate.blockedRecoveryScopeKeys.add(ticket.recoveryScopeKey);
  return true;
}

export function cardLimitsMutationRecoveryState(
  gate: CardLimitsMutationGate,
  scopeKey: string | null,
  recoveryScopeKey: string | null,
): { canSubmit: boolean; retryPending: boolean; conflictPending: boolean } {
  if (!scopeKey || !recoveryScopeKey) {
    return { canSubmit: false, retryPending: false, conflictPending: false };
  }
  if (gate.blockedRecoveryScopeKeys.has(recoveryScopeKey)) {
    return { canSubmit: false, retryPending: false, conflictPending: true };
  }
  const retry = gate.retries.get(recoveryScopeKey);
  if (!retry) return { canSubmit: true, retryPending: false, conflictPending: false };
  if (retry.scopeKey !== scopeKey) {
    return { canSubmit: false, retryPending: false, conflictPending: true };
  }
  return { canSubmit: true, retryPending: true, conflictPending: false };
}

export function acceptsCardLimitsMutationCompletion(
  gate: CardLimitsMutationGate,
  ticket: CardLimitsMutationTicket,
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

export function settleCardLimitsMutation(
  gate: CardLimitsMutationGate,
  ticket: CardLimitsMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsCardLimitsMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type CardLimitsMutationAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "rejected"; scopeKey: string; message: string }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "succeeded"; requestKey: string; limits: WalletCardLimits }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "retryable"; requestKey: string; message: string }
  | { type: "conflicted"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function cardLimitsMutationReducer(
  state: CardLimitsMutationState,
  action: CardLimitsMutationAction,
): CardLimitsMutationState {
  switch (action.type) {
    case "reset":
      return { ...initialCardLimitsMutationState, scopeKey: action.scopeKey };
    case "rejected":
      return action.scopeKey === state.scopeKey
        ? { ...state, busy: false, error: action.message, updatedLimits: null }
        : state;
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        updatedLimits: null,
        retryPending: false,
        conflictPending: false,
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, updatedLimits: action.limits }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? {
            ...state,
            error: action.message,
            updatedLimits: null,
            retryPending: false,
            conflictPending: false,
          }
        : state;
    case "retryable":
      return action.requestKey === state.activeRequestKey
        ? {
            ...state,
            error: action.message,
            updatedLimits: null,
            retryPending: true,
            conflictPending: false,
          }
        : state;
    case "conflicted":
      return action.requestKey === state.activeRequestKey
        ? {
            ...state,
            error: action.message,
            updatedLimits: null,
            retryPending: false,
            conflictPending: true,
          }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}
