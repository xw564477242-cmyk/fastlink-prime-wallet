import { BackendApiError } from "./backend-api";
import { FxQuoteContractError, type FxQuote } from "./fx-quote-contract";

export const FX_QUOTE_SAFE_ERROR = "FX quote preview is temporarily unavailable. Please try again.";
export const FX_QUOTE_SESSION_INVALID = "Your authenticated wallet session is no longer valid.";

export type FxQuoteFailureKind = "RETRYABLE" | "AUTH_INVALID" | "REJECTED";

export type FxQuoteState = Readonly<{
  scopeKey: string | null;
  activeRequestKey: string | null;
  busy: boolean;
  error: string | null;
  sessionInvalid: boolean;
  quote: FxQuote | null;
}>;

export const initialFxQuoteState: FxQuoteState = Object.freeze({
  scopeKey: null,
  activeRequestKey: null,
  busy: false,
  error: null,
  sessionInvalid: false,
  quote: null,
});

export type FxQuoteGate = {
  scopeKey: string | null;
  generation: number;
  activeRequestKey: string | null;
};

export type FxQuoteTicket = Readonly<{
  scopeKey: string;
  generation: number;
  requestKey: string;
}>;

export function createFxQuoteGate(scopeKey: string | null): FxQuoteGate {
  return { scopeKey, generation: 0, activeRequestKey: null };
}

export function syncFxQuoteScope(gate: FxQuoteGate, scopeKey: string | null): void {
  if (gate.scopeKey === scopeKey) return;
  gate.scopeKey = scopeKey;
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function invalidateFxQuoteGate(gate: FxQuoteGate): void {
  gate.generation += 1;
  gate.activeRequestKey = null;
}

export function beginFxQuoteRequest(gate: FxQuoteGate, scopeKey: string): FxQuoteTicket {
  syncFxQuoteScope(gate, scopeKey);
  gate.generation += 1;
  const requestKey = JSON.stringify([scopeKey, gate.generation]);
  gate.activeRequestKey = requestKey;
  return { scopeKey, generation: gate.generation, requestKey };
}

export function acceptsFxQuoteCompletion(
  gate: FxQuoteGate,
  ticket: FxQuoteTicket,
  currentScopeKey: string | null,
  mounted: boolean,
): boolean {
  return (
    mounted &&
    currentScopeKey !== null &&
    gate.scopeKey === currentScopeKey &&
    ticket.scopeKey === currentScopeKey &&
    gate.generation === ticket.generation &&
    gate.activeRequestKey === ticket.requestKey
  );
}

export function settleFxQuoteRequest(
  gate: FxQuoteGate,
  ticket: FxQuoteTicket,
  currentScopeKey: string | null,
  mounted: boolean,
): boolean {
  if (!acceptsFxQuoteCompletion(gate, ticket, currentScopeKey, mounted)) return false;
  gate.activeRequestKey = null;
  return true;
}

export function classifyFxQuoteFailure(reason: unknown): FxQuoteFailureKind {
  if (reason instanceof BackendApiError && reason.status === 401) return "AUTH_INVALID";
  if (reason instanceof FxQuoteContractError) return "REJECTED";
  if (
    !(reason instanceof BackendApiError) ||
    reason.status === 0 ||
    reason.status === 408 ||
    reason.status === 429 ||
    (reason.status >= 500 && reason.status <= 599)
  ) {
    return "RETRYABLE";
  }
  return "REJECTED";
}

export type FxQuoteAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "started"; scopeKey: string; requestKey: string }
  | { type: "loaded"; requestKey: string; quote: FxQuote }
  | { type: "failed"; requestKey: string; kind: FxQuoteFailureKind }
  | { type: "settled"; requestKey: string };

export function fxQuoteReducer(state: FxQuoteState, action: FxQuoteAction): FxQuoteState {
  switch (action.type) {
    case "reset":
      return { ...initialFxQuoteState, scopeKey: action.scopeKey };
    case "started":
      if (state.scopeKey !== action.scopeKey) return state;
      return {
        ...state,
        activeRequestKey: action.requestKey,
        busy: true,
        error: null,
        sessionInvalid: false,
      };
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: null, sessionInvalid: false, quote: action.quote }
        : state;
    case "failed":
      if (action.requestKey !== state.activeRequestKey) return state;
      if (action.kind === "AUTH_INVALID") {
        return {
          ...state,
          error: FX_QUOTE_SESSION_INVALID,
          sessionInvalid: true,
          quote: null,
        };
      }
      return {
        ...state,
        error: FX_QUOTE_SAFE_ERROR,
        sessionInvalid: false,
        quote: action.kind === "RETRYABLE" ? state.quote : null,
      };
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, busy: false }
        : state;
  }
}

export function fxQuoteView(state: FxQuoteState, scopeKey: string | null): FxQuoteState {
  return state.scopeKey === scopeKey ? state : { ...initialFxQuoteState, scopeKey };
}
