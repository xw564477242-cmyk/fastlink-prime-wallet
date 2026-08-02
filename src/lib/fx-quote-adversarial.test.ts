import { describe, expect, it } from "bun:test";
import { BackendApiError, type BackendSession, type FastLinkEnvironment } from "./backend-api";
import {
  FX_QUOTE_MAX_JSON_BYTES,
  FX_QUOTE_MAX_VALIDITY_MS,
  FX_QUOTE_PATH,
  FxQuoteContractError,
  buildFxQuoteRequest,
  fxQuoteScopeKey,
  fxQuoteSessionAllowed,
  normalizeFxQuoteInput,
  normalizeFxQuoteResponse,
  type FxQuote,
} from "./fx-quote-contract";
import {
  FX_QUOTE_SAFE_ERROR,
  FX_QUOTE_SESSION_INVALID,
  acceptsFxQuoteCompletion,
  beginFxQuoteRequest,
  classifyFxQuoteFailure,
  createFxQuoteGate,
  fxQuoteReducer,
  initialFxQuoteState,
  settleFxQuoteRequest,
  syncFxQuoteScope,
} from "./fx-quote-state";

const NOW = Date.parse("2026-08-02T04:00:00.000Z");

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-fx-01",
    tenantId: "tenant-fx-01",
    customerId: "customer-fx-01",
    environment: "SANDBOX",
    expiresAt: "2026-08-02T05:00:00.000Z",
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    sourceAssetCode: "USD",
    targetAssetCode: "MYR",
    sourceAmount: "100.00",
    ...overrides,
  };
}

function quote(overrides: Record<string, unknown> = {}) {
  return {
    quoteId: "quote-sandbox-001",
    environment: "SANDBOX",
    sourceAssetCode: "USD",
    targetAssetCode: "MYR",
    sourceAmount: "100",
    targetAmount: "441",
    rate: "4.41",
    expiresAt: "2026-08-02T04:05:00.000Z",
    ...overrides,
  };
}

describe("FX quote exact request contract", () => {
  it("builds one exact POST with only the three public quote inputs", () => {
    const request = buildFxQuoteRequest(input());
    expect(request.path).toBe(FX_QUOTE_PATH);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toBeUndefined();
    expect(JSON.parse(String(request.init.body))).toEqual({
      sourceAssetCode: "USD",
      targetAssetCode: "MYR",
      sourceAmount: "100",
    });
    expect(Object.keys(JSON.parse(String(request.init.body))).sort()).toEqual([
      "sourceAmount",
      "sourceAssetCode",
      "targetAssetCode",
    ]);
  });

  it("accepts exact safe values and rejects extra, accessor, invalid or same-asset input", () => {
    expect(normalizeFxQuoteInput(input())).toEqual({
      sourceAssetCode: "USD",
      targetAssetCode: "MYR",
      sourceAmount: "100",
    });
    for (const invalid of [
      input({ environment: "SANDBOX" }),
      input({ provider: "private" }),
      input({ sourceAssetCode: "usd" }),
      input({ sourceAssetCode: "U" }),
      input({ targetAssetCode: "USD" }),
      input({ sourceAmount: "0" }),
      input({ sourceAmount: "01" }),
      input({ sourceAmount: "1e2" }),
      input({ sourceAmount: "+1" }),
      input({ sourceAmount: "1.0000000000000000000" }),
    ]) {
      expect(() => normalizeFxQuoteInput(invalid)).toThrow(FxQuoteContractError);
    }
    let reads = 0;
    const accessor = input();
    Object.defineProperty(accessor, "sourceAmount", {
      enumerable: true,
      get() {
        reads += 1;
        return "100";
      },
    });
    expect(() => normalizeFxQuoteInput(accessor)).toThrow(FxQuoteContractError);
    expect(reads).toBe(0);
  });
});

describe("FX quote exact response contract", () => {
  it("returns exactly the eight public response fields", () => {
    const result = normalizeFxQuoteResponse(
      JSON.stringify(quote()),
      "SANDBOX",
      normalizeFxQuoteInput(input()),
      NOW,
    );
    expect(result).toEqual(quote());
    expect(Object.keys(result)).toEqual([
      "quoteId",
      "environment",
      "sourceAssetCode",
      "targetAssetCode",
      "sourceAmount",
      "targetAmount",
      "rate",
      "expiresAt",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects extra private fields and every scope or decimal mismatch", () => {
    for (const patch of [
      { tenantId: "private" },
      { customerId: "private" },
      { provider: "private" },
      { environment: "TEST" },
      { environment: "UAT" },
      { sourceAssetCode: "EUR" },
      { targetAssetCode: "SGD" },
      { sourceAmount: "100.0" },
      { targetAmount: "440" },
      { targetAmount: "441.0" },
      { targetAmount: "0" },
      { rate: "4.410" },
      { rate: "NaN" },
      { quoteId: "quote id" },
      { expiresAt: "2026-08-02T03:59:59.999Z" },
      { expiresAt: new Date(NOW + FX_QUOTE_MAX_VALIDITY_MS + 1).toISOString() },
      { expiresAt: "2026-02-30T04:05:00.000Z" },
    ]) {
      expect(() =>
        normalizeFxQuoteResponse(
          JSON.stringify(quote(patch)),
          "SANDBOX",
          normalizeFxQuoteInput(input()),
          NOW,
        ),
      ).toThrow(FxQuoteContractError);
    }
  });

  it("rejects malformed, oversized and duplicate or escaped-equivalent keys", () => {
    expect(FX_QUOTE_MAX_JSON_BYTES).toBe(4_096);
    for (const raw of [
      "not-json",
      "[]",
      "{}",
      " ".repeat(FX_QUOTE_MAX_JSON_BYTES + 1),
      JSON.stringify(quote()).replace('"quoteId":', '"quoteId":"first","quoteId":'),
      JSON.stringify(quote()).replace('"quoteId":', '"quoteId":"first","quote\\u0049d":'),
    ]) {
      expect(() =>
        normalizeFxQuoteResponse(raw, "SANDBOX", normalizeFxQuoteInput(input()), NOW),
      ).toThrow(FxQuoteContractError);
    }
  });
});

describe("FX quote session, scope and request generation", () => {
  it("allows only a matching unexpired SANDBOX or TEST authenticated session", () => {
    expect(fxQuoteSessionAllowed(session(), "SANDBOX", NOW)).toBe(true);
    expect(fxQuoteSessionAllowed(session({ environment: "TEST" }), "TEST", NOW)).toBe(true);
    const denied: Array<[BackendSession | null, FastLinkEnvironment | undefined]> = [
      [null, "SANDBOX"],
      [session(), "TEST"],
      [session(), "LOCAL"],
      [session(), "UAT"],
      [session(), "PRODUCTION"],
      [session(), undefined],
      [session({ expiresAt: "2026-08-02T04:00:00.000Z" }), "SANDBOX"],
      [session({ actorId: "" }), "SANDBOX"],
      [session({ tenantId: "" }), "SANDBOX"],
      [session({ customerId: "" }), "SANDBOX"],
    ];
    for (const [current, environment] of denied) {
      expect(fxQuoteSessionAllowed(current, environment, NOW)).toBe(false);
    }
  });

  it("binds actor, tenant, customer, environment, exact input and input generation", () => {
    const base = fxQuoteScopeKey(session(), "SANDBOX", input(), 1, NOW);
    expect(base).not.toBeNull();
    for (const changed of [
      fxQuoteScopeKey(session({ actorId: "actor-fx-02" }), "SANDBOX", input(), 1, NOW),
      fxQuoteScopeKey(session({ tenantId: "tenant-fx-02" }), "SANDBOX", input(), 1, NOW),
      fxQuoteScopeKey(session({ customerId: "customer-fx-02" }), "SANDBOX", input(), 1, NOW),
      fxQuoteScopeKey(session({ environment: "TEST" }), "TEST", input(), 1, NOW),
      fxQuoteScopeKey(session(), "SANDBOX", input({ targetAssetCode: "SGD" }), 1, NOW),
      fxQuoteScopeKey(session(), "SANDBOX", input(), 2, NOW),
    ]) {
      expect(changed).not.toBe(base);
    }
    expect(
      fxQuoteScopeKey(session(), "SANDBOX", input({ targetAssetCode: "USD" }), 1, NOW),
    ).toBeNull();
  });

  it("accepts only the latest mounted request and preserves a verified quote only for retryable failure", () => {
    const scope = fxQuoteScopeKey(session(), "SANDBOX", input(), 1, NOW)!;
    const gate = createFxQuoteGate(scope);
    const first = beginFxQuoteRequest(gate, scope);
    const second = beginFxQuoteRequest(gate, scope);
    expect(acceptsFxQuoteCompletion(gate, first, scope, true)).toBe(false);
    expect(acceptsFxQuoteCompletion(gate, second, scope, false)).toBe(false);
    expect(acceptsFxQuoteCompletion(gate, second, scope, true)).toBe(true);
    expect(settleFxQuoteRequest(gate, second, scope, true)).toBe(true);
    syncFxQuoteScope(gate, `${scope}-changed`);
    expect(acceptsFxQuoteCompletion(gate, second, scope, true)).toBe(false);

    const value = quote() as FxQuote;
    let state = fxQuoteReducer(initialFxQuoteState, { type: "reset", scopeKey: scope });
    state = fxQuoteReducer(state, { type: "started", scopeKey: scope, requestKey: "one" });
    state = fxQuoteReducer(state, { type: "loaded", requestKey: "one", quote: value });
    state = fxQuoteReducer(state, { type: "settled", requestKey: "one" });
    state = fxQuoteReducer(state, { type: "started", scopeKey: scope, requestKey: "two" });
    state = fxQuoteReducer(state, { type: "failed", requestKey: "two", kind: "RETRYABLE" });
    expect(state.quote).toEqual(value);
    expect(state.error).toBe(FX_QUOTE_SAFE_ERROR);
    state = fxQuoteReducer(state, { type: "started", scopeKey: scope, requestKey: "three" });
    state = fxQuoteReducer(state, { type: "failed", requestKey: "three", kind: "AUTH_INVALID" });
    expect(state.quote).toBeNull();
    expect(state.sessionInvalid).toBe(true);
    expect(state.error).toBe(FX_QUOTE_SESSION_INVALID);
  });

  it("marks session invalid only for an explicit HTTP 401", () => {
    expect(classifyFxQuoteFailure(new BackendApiError(401, "safe", "redacted"))).toBe(
      "AUTH_INVALID",
    );
    for (const status of [0, 408, 429, 500, 503]) {
      expect(classifyFxQuoteFailure(new BackendApiError(status, "safe", "redacted"))).toBe(
        "RETRYABLE",
      );
    }
    for (const status of [400, 403, 404, 409, 410, 422]) {
      expect(classifyFxQuoteFailure(new BackendApiError(status, "safe", "redacted"))).toBe(
        "REJECTED",
      );
    }
    expect(classifyFxQuoteFailure(new FxQuoteContractError())).toBe("RETRYABLE");
  });
});
