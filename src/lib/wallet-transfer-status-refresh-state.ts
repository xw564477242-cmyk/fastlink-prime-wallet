import {
  normalizeWalletTransferStatusExpectation,
  walletTransferSessionAllowed,
  type BackendSession,
  type FastLinkEnvironment,
  type WalletOperationActivity,
} from "./backend-api";

export type WalletTransferReceiptContext = Readonly<{
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  transferRequestKey: string;
  transferGeneration: number;
  operation: WalletOperationActivity;
}>;

export type WalletTransferStatusRefreshGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
};

export type WalletTransferStatusRefreshTicket = Readonly<{
  scopeKey: string;
  generation: number;
  requestKey: string;
}>;

export type WalletTransferStatusRefreshState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  loading: boolean;
  error: string | null;
  operation: WalletOperationActivity | null;
};

export const initialWalletTransferStatusRefreshState: WalletTransferStatusRefreshState = {
  scopeKey: null,
  activeRequestKey: null,
  loading: false,
  error: null,
  operation: null,
};

function receiptContext(value: WalletTransferReceiptContext): WalletTransferReceiptContext {
  if (
    Object.getPrototypeOf(value) !== Object.prototype ||
    !/^[A-Za-z0-9._:-]{2,128}$/.test(value.sourceAccountId) ||
    !/^[A-Za-z0-9._:-]{2,128}$/.test(value.destinationAccountId) ||
    value.sourceAccountId === value.destinationAccountId ||
    typeof value.transferRequestKey !== "string" ||
    value.transferRequestKey.length < 8 ||
    value.transferRequestKey.length > 2048 ||
    !Number.isSafeInteger(value.transferGeneration) ||
    value.transferGeneration < 1
  ) {
    throw new Error("Invalid Wallet transfer receipt context");
  }
  const operation = normalizeWalletTransferStatusExpectation({ previous: value.operation });
  if (value.amount !== operation.amount) {
    throw new Error("Invalid Wallet transfer receipt amount");
  }
  return { ...value, operation };
}

export function walletTransferStatusRefreshScopeKey(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  context: WalletTransferReceiptContext | null,
  sessionGeneration = 0,
): string | null {
  if (
    !session ||
    !runtimeEnvironment ||
    !walletTransferSessionAllowed(session, runtimeEnvironment) ||
    !context
  ) {
    return null;
  }
  try {
    const receipt = receiptContext(context);
    return JSON.stringify([
      sessionGeneration,
      session.actorId,
      session.expiresAt,
      session.tenantId,
      session.customerId,
      session.environment,
      runtimeEnvironment,
      receipt.sourceAccountId,
      receipt.destinationAccountId,
      receipt.amount,
      receipt.transferRequestKey,
      receipt.transferGeneration,
      receipt.operation.id,
      receipt.operation.type,
      receipt.operation.status,
      receipt.operation.assetCode,
      receipt.operation.amount,
      receipt.operation.direction,
      receipt.operation.createdAt,
      receipt.operation.completedAt,
      receipt.operation.updatedAt,
    ]);
  } catch {
    return null;
  }
}

export function walletTransferStatusRefreshView(
  state: WalletTransferStatusRefreshState,
  scopeKey: string | null,
): WalletTransferStatusRefreshState {
  return state.scopeKey === scopeKey
    ? state
    : { ...initialWalletTransferStatusRefreshState, scopeKey };
}

export function createWalletTransferStatusRefreshGate(
  scopeKey: string | null,
): WalletTransferStatusRefreshGate {
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncWalletTransferStatusRefreshScope(
  gate: WalletTransferStatusRefreshGate,
  scopeKey: string | null,
): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function invalidateWalletTransferStatusRefreshGate(
  gate: WalletTransferStatusRefreshGate,
): void {
  gate.scopeKey = null;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function beginWalletTransferStatusRefresh(
  gate: WalletTransferStatusRefreshGate,
  scopeKey: string,
): WalletTransferStatusRefreshTicket | null {
  syncWalletTransferStatusRefreshScope(gate, scopeKey);
  if (gate.activeRequestKey !== null) return null;
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, requestKey };
}

export function acceptsWalletTransferStatusRefreshCompletion(
  gate: WalletTransferStatusRefreshGate,
  ticket: WalletTransferStatusRefreshTicket,
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

export function settleWalletTransferStatusRefresh(
  gate: WalletTransferStatusRefreshGate,
  ticket: WalletTransferStatusRefreshTicket,
  currentScopeKey: string | null,
): boolean {
  if (!acceptsWalletTransferStatusRefreshCompletion(gate, ticket, currentScopeKey)) return false;
  gate.activeRequestKey = null;
  return true;
}

export type WalletTransferStatusRefreshAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "loaded"; requestKey: string; operation: WalletOperationActivity }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function walletTransferStatusRefreshReducer(
  state: WalletTransferStatusRefreshState,
  action: WalletTransferStatusRefreshAction,
): WalletTransferStatusRefreshState {
  switch (action.type) {
    case "reset":
      return { ...initialWalletTransferStatusRefreshState, scopeKey: action.scopeKey };
    case "started":
      return {
        scopeKey: action.scopeKey,
        activeRequestKey: action.requestKey,
        loading: true,
        error: null,
        operation: null,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, operation: action.operation, error: null }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, operation: null, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, loading: false }
        : state;
  }
}
