import {
  isVirtualCardCreateEnvironment,
  validateVirtualCardIdempotencyKey,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletCard,
} from "./backend-api";

export type VirtualCardCreateGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
};

export type VirtualCardCreateTicket = Readonly<{
  scopeKey: string;
  generation: number;
  idempotencyKey: string;
  requestKey: string;
}>;

export type VirtualCardCreateState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  createdCard: WalletCard | null;
};

export const initialVirtualCardCreateState: VirtualCardCreateState = {
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  createdCard: null,
};

export function virtualCardCreateScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string"
  ) {
    return null;
  }
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return JSON.stringify([
    session.actorId,
    session.expiresAt,
    session.tenantId,
    session.customerId,
    session.environment,
    runtimeEnvironment,
  ]);
}

export function virtualCardCreateView(
  state: VirtualCardCreateState,
  scopeKey: string | null,
): VirtualCardCreateState {
  return state.scopeKey === scopeKey ? state : { ...initialVirtualCardCreateState, scopeKey };
}

export function createVirtualCardCreateGate(scopeKey: string | null): VirtualCardCreateGate {
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncVirtualCardCreateScope(
  gate: VirtualCardCreateGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function newVirtualCardIdempotencyKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error("Secure idempotency generation is unavailable");
  return validateVirtualCardIdempotencyKey(key);
}

export function beginVirtualCardCreate(
  gate: VirtualCardCreateGate,
  scopeKey: string,
  keyFactory: () => string = newVirtualCardIdempotencyKey,
): VirtualCardCreateTicket | null {
  syncVirtualCardCreateScope(gate, scopeKey);
  if (gate.activeRequestKey !== null) return null;
  const idempotencyKey = validateVirtualCardIdempotencyKey(keyFactory());
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, idempotencyKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, idempotencyKey, requestKey };
}

export function acceptsVirtualCardCreateCompletion(
  gate: VirtualCardCreateGate,
  ticket: VirtualCardCreateTicket,
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

export function settleVirtualCardCreate(
  gate: VirtualCardCreateGate,
  ticket: VirtualCardCreateTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsVirtualCardCreateCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type VirtualCardCreateAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "succeeded"; requestKey: string; card: WalletCard }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function virtualCardCreateReducer(
  state: VirtualCardCreateState,
  action: VirtualCardCreateAction,
): VirtualCardCreateState {
  switch (action.type) {
    case "reset":
      return { ...initialVirtualCardCreateState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        createdCard: null,
      };
    case "succeeded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, createdCard: action.card }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message, createdCard: null }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}
