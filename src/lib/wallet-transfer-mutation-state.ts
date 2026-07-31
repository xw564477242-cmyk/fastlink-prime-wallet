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
};

export type WalletTransferMutationTicket = Readonly<{
  scopeKey: string;
  generation: number;
  input: WalletTransferInput;
  idempotencyKey: string;
  requestKey: string;
}>;

export type WalletTransferMutationState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  operation: WalletOperationActivity | null;
};

export const initialWalletTransferMutationState: WalletTransferMutationState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  operation: null,
};

export function walletTransferMutationScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  source: WalletTransferAccount | null,
  input: unknown,
): string | null {
  if (!session || !walletTransferSessionAllowed(session, runtimeEnvironment) || !source) {
    return null;
  }
  try {
    const normalizedSource = normalizeWalletTransferSourceAccount(source);
    const normalizedInput = normalizeWalletTransferInput(input, normalizedSource);
    if (normalizedSource.status !== "active") return null;
    return JSON.stringify([
      session.actorId,
      session.expiresAt,
      session.tenantId,
      session.customerId,
      session.environment,
      runtimeEnvironment,
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
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncWalletTransferMutationScope(
  gate: WalletTransferMutationGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
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
  if (gate.activeRequestKey !== null) return null;
  const normalizedInput = normalizeWalletTransferInput(input, source);
  const idempotencyKey = validateVirtualCardIdempotencyKey(keyFactory());
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
  };
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
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, operation: action.operation }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, operation: null }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}
