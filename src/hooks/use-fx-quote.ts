import { useCallback, useEffect, useReducer, useRef } from "react";
import { backendApi, backendRuntime, type BackendSession } from "@/lib/backend-api";
import {
  fxQuoteScopeKey,
  fxQuoteSessionAllowed,
  normalizeFxQuoteInput,
  type FxQuoteInput,
} from "@/lib/fx-quote-contract";
import {
  acceptsFxQuoteCompletion,
  beginFxQuoteRequest,
  classifyFxQuoteFailure,
  createFxQuoteGate,
  fxQuoteReducer,
  fxQuoteView,
  initialFxQuoteState,
  invalidateFxQuoteGate,
  settleFxQuoteRequest,
  syncFxQuoteScope,
} from "@/lib/fx-quote-state";

type RequestContext = Readonly<{
  scopeKey: string;
  session: BackendSession;
  input: FxQuoteInput;
}>;

export function useFxQuote(
  session: BackendSession | null,
  input: unknown,
  inputGeneration: number,
) {
  const runtimeEnvironment = backendRuntime.error === null ? backendRuntime.environment : undefined;
  const scopeKey = fxQuoteScopeKey(session, runtimeEnvironment, input, inputGeneration);
  const [state, dispatch] = useReducer(fxQuoteReducer, initialFxQuoteState);
  const gate = useRef(createFxQuoteGate(scopeKey));
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const currentScope = useRef(scopeKey);
  const requestContext = useRef<RequestContext | null>(null);
  syncFxQuoteScope(gate.current, scopeKey);
  currentScope.current = scopeKey;
  requestContext.current =
    scopeKey && session ? { scopeKey, session, input: normalizeFxQuoteInput(input) } : null;
  const view = fxQuoteView(state, scopeKey);

  const requestQuote = useCallback(async (): Promise<boolean> => {
    const context = requestContext.current;
    if (!context || activeRequest.current) return false;
    const controller = new AbortController();
    activeRequest.current = controller;
    const ticket = beginFxQuoteRequest(gate.current, context.scopeKey);
    const isCurrent = () =>
      activeRequest.current === controller &&
      currentScope.current === context.scopeKey &&
      fxQuoteSessionAllowed(context.session, backendRuntime.environment) &&
      acceptsFxQuoteCompletion(gate.current, ticket, currentScope.current, mounted.current);
    dispatch({ type: "started", scopeKey: context.scopeKey, requestKey: ticket.requestKey });
    try {
      const quote = await backendApi.createFxQuotePreview(
        context.session,
        context.input,
        controller.signal,
      );
      if (!isCurrent()) return false;
      dispatch({ type: "loaded", requestKey: ticket.requestKey, quote });
      return true;
    } catch (reason) {
      if (isCurrent()) {
        dispatch({
          type: "failed",
          requestKey: ticket.requestKey,
          kind: classifyFxQuoteFailure(reason),
        });
      }
      return false;
    } finally {
      if (settleFxQuoteRequest(gate.current, ticket, currentScope.current, mounted.current)) {
        activeRequest.current = null;
        dispatch({ type: "settled", requestKey: ticket.requestKey });
      }
    }
  }, []);

  useEffect(() => {
    const mountedGate = gate.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
      invalidateFxQuoteGate(mountedGate);
    };
  }, []);

  useEffect(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    syncFxQuoteScope(gate.current, scopeKey);
    dispatch({ type: "reset", scopeKey });
  }, [scopeKey]);

  return {
    ...view,
    allowed: scopeKey !== null,
    requestQuote,
  };
}
