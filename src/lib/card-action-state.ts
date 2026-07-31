import type { BackendSession, WalletCard } from "./backend-api";

export type CardAction = "refresh" | "freeze" | "unfreeze" | "issue";

export type CardActionGate = {
  generation: number;
  scopeKey: string | null;
};

export type CardActionTicket = Readonly<{
  generation: number;
  scopeKey: string;
  action: CardAction;
}>;

export type CardActionUiState = {
  scopeKey: string | null;
  busy: boolean;
  error: string | null;
};

export const cardSessionScopeKey = (session: BackendSession | null): string | null =>
  session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;

export const cardActionScopeKey = (
  sessionKey: string | null,
  cardId: string | null,
): string | null => (sessionKey ? JSON.stringify([sessionKey, cardId]) : null);

export const createCardActionGate = (scopeKey: string | null): CardActionGate => ({
  generation: 0,
  scopeKey,
});

export function syncCardActionScope(gate: CardActionGate, scopeKey: string | null): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
}

export function beginCardAction(
  gate: CardActionGate,
  scopeKey: string,
  action: CardAction,
): CardActionTicket {
  syncCardActionScope(gate, scopeKey);
  gate.generation += 1;
  return { generation: gate.generation, scopeKey, action };
}

export const acceptsCardActionResponse = (
  gate: CardActionGate,
  ticket: CardActionTicket,
  currentScopeKey: string | null,
): boolean =>
  currentScopeKey !== null &&
  gate.generation === ticket.generation &&
  gate.scopeKey === currentScopeKey &&
  ticket.scopeKey === currentScopeKey;

export function cardActionAllowed(
  action: CardAction,
  scopeReady: boolean,
  sessionKey: string | null,
  card: WalletCard | undefined,
): boolean {
  if (!scopeReady || sessionKey === null) return false;
  if (action === "issue") return true;
  if (!card) return false;
  if (action === "refresh") return true;
  if (action === "freeze") return card.status === "active" && card.capabilities.freeze;
  return card.status === "frozen" && card.capabilities.unfreeze;
}

export const visibleCardActionState = (
  state: CardActionUiState,
  currentScopeKey: string | null,
): CardActionUiState =>
  state.scopeKey === currentScopeKey
    ? state
    : { scopeKey: currentScopeKey, busy: false, error: null };
