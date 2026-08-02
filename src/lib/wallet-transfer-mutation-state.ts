import {
  normalizeWalletTransferInput,
  normalizeWalletTransferSourceAccount,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletOperationActivity,
  type WalletTransferAccount,
  type WalletTransferInput,
  walletTransferSessionAllowed,
} from "./backend-api";

export type WalletTransferMutationGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
  retry: WalletTransferMutationRetry | null;
  blocked: boolean;
};

export type WalletTransferMutationRetry = Readonly<{
  scopeKey: string;
  input: WalletTransferInput;
  idempotencyKey: string;
}>;

export type WalletTransferMutationTicket = Readonly<{
  scopeKey: string;
  generation: number;
  input: WalletTransferInput;
  idempotencyKey: string;
  requestKey: string;
  retry: boolean;
}>;

export type WalletTransferMutationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  operation: WalletOperationActivity | null;
  retryPending: boolean;
  conflictPending: boolean;
};

export const initialWalletTransferMutationState: WalletTransferMutationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  operation: null,
  retryPending: false,
  conflictPending: false,
};

export function walletTransferMutationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  source: WalletTransferAccount | null,
  input: unknown,
  sessionGeneration = 0,
  sourceGeneration = 0,
  inputGeneration = 0,
  runtimeApiUrl = "/api",
): string | null {
  if (
    !session ||
    runtimeApiUrl !== "/api" ||
    !Number.isSafeInteger(sessionGeneration) ||
    sessionGeneration < 0 ||
    !Number.isSafeInteger(sourceGeneration) ||
    sourceGeneration < 0 ||
    !Number.isSafeInteger(inputGeneration) ||
    inputGeneration < 0 ||
    !walletTransferSessionAllowed(session, runtimeEnvironment) ||
    !source
  ) {
    return null;
  }
  try {
    const normalizedSource = normalizeWalletTransferSourceAccount(source);
    const normalizedInput = normalizeWalletTransferInput(input, normalizedSource);
    if (normalizedSource.status !== "active") return null;
    return JSON.stringify([
      sessionGeneration,
      sourceGeneration,
      inputGeneration,
      session.actorId,
      session.expiresAt,
      session.tenantId,
      session.customerId,
      session.environment,
      runtimeEnvironment,
      runtimeApiUrl,
      normalizedSource.id,
      normalizedSource.assetCode,
      normalizedSource.status,
      normalizedSource.currentBalance,
      normalizedSource.postedBalance,
      normalizedSource.pendingBalance,
      normalizedSource.availableBalance,
      normalizedSource.updatedAt,
      normalizedInput.destinationAccountId,
      normalizedInput.amount,
    ]);
  } catch {
    return null;
  }
}

export function walletTransferMutationView(
  state: WalletTransferMutationState,
  scopeKey: string | null,
): WalletTransferMutationState {
  return state.scopeKey === scopeKey ? state : { ...initialWalletTransferMutationState, scopeKey };
}

export function createWalletTransferMutationGate(
  scopeKey: string | null,
): WalletTransferMutationGate {
  return { scopeKey, generation: 0, activeRequestKey: null, retry: null, blocked: false };
}

export function syncWalletTransferMutationScope(
  gate: WalletTransferMutationGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retry = null;
  gate.blocked = false;
}

export function invalidateWalletTransferMutationGate(gate: WalletTransferMutationGate): void {
  gate.scopeKey = null;
  gate.generation += 1;
  gate.activeRequestKey = null;
  gate.retry = null;
  gate.blocked = false;
}

function newWalletTransferIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error("Secure idempotency generation is unavailable");
  return validateVirtualCardIdempotencyKey(key);
}

export function beginWalletTransferMutation(
  gate: WalletTransferMutationGate,
  scopeKey: string,
  source: WalletTransferAccount,
  input: unknown,
  keyFactory: () => string = newWalletTransferIdempotencyKey,
): WalletTransferMutationTicket | null {
  syncWalletTransferMutationScope(gate, scopeKey);
  if (gate.activeRequestKey !== null || gate.blocked) return null;
  const normalizedInput = normalizeWalletTransferInput(input, source);
  const retry = gate.retry;
  if (
    retry &&
    (retry.scopeKey !== scopeKey ||
      retry.input.destinationAccountId !== normalizedInput.destinationAccountId ||
      retry.input.amount !== normalizedInput.amount)
  ) {
    gate.retry = null;
    return null;
  }
  const idempotencyKey = retry
    ? retry.idempotencyKey
    : validateVirtualCardIdempotencyKey(keyFactory());
  gate.retry = null;
  gate.generation += 1;
  const requestKey = JSON.stringify([
    scopeKey,
    normalizedInput.destinationAccountId,
    normalizedInput.amount,
    idempotencyKey,
    gate.generation,
  ]);
  gate.activeRequestKey = requestKey;
  return {
    scopeKey,
    generation: gate.generation,
    input: normalizedInput,
    idempotencyKey,
    requestKey,
    retry: retry !== null,
  };
}

export function walletTransferFailureIsAmbiguous(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(reason, "status");
  } catch {
    return false;
  }
  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number") {
    return false;
  }
  return (
    descriptor.value === 0 ||
    descriptor.value === 408 ||
    (descriptor.value >= 500 && descriptor.value <= 599)
  );
}

export function walletTransferFailureIsExplicit401(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(reason, "status");
    return Boolean(descriptor && "value" in descriptor && descriptor.value === 401);
  } catch {
    return false;
  }
}

export function retainWalletTransferMutationRetry(
  gate: WalletTransferMutationGate,
  ticket: WalletTransferMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsWalletTransferMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.retry = Object.freeze({
    scopeKey: ticket.scopeKey,
    input: ticket.input,
    idempotencyKey: ticket.idempotencyKey,
  });
  return true;
}

export function clearWalletTransferMutationRetry(gate: WalletTransferMutationGate): void {
  gate.retry = null;
}

export function blockWalletTransferMutation(
  gate: WalletTransferMutationGate,
  ticket: WalletTransferMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsWalletTransferMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.retry = null;
  gate.blocked = true;
  return true;
}

export function acceptsWalletTransferMutationCompletion(
  gate: WalletTransferMutationGate,
  ticket: WalletTransferMutationTicket,
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

export function settleWalletTransferMutation(
  gate: WalletTransferMutationGate,
  ticket: WalletTransferMutationTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsWalletTransferMutationCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type WalletTransferMutationAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "succeeded"; requestKey: string; operation: WalletOperationActivity }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "retryable"; requestKey: string; message: string }
  | { type: "conflicted"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function walletTransferMutationReducer(
  state: WalletTransferMutationState,
  action: WalletTransferMutationAction,
): WalletTransferMutationState {
  switch (action.type) {
    case "reset":
      return { ...initialWalletTransferMutationState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        operation: null,
        retryPending: false,
        conflictPending: false,
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, operation: action.operation, retryPending: false }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, operation: null, retryPending: false }
        : state;
    case "retryable":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, operation: null, retryPending: true }
        : state;
    case "conflicted":
      return action.requestKey === state.activeRequestKey
        ? {
            ...state,
            error: action.message,
            operation: null,
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
