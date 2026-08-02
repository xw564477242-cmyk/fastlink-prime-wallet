import { describe, expect, it } from "bun:test";
import { BackendApiError, type BackendSession, type FastLinkEnvironment } from "./backend-api";
import {
  BACKEND_SESSION_INVALIDATION_REASONS,
  backendSessionAfterInvalidation,
  backendSessionIntrinsicInvalidationReason,
  backendSessionInvalidationReasonFromError,
  backendSessionRequestCanCommit,
  isBackendSessionInvalidationReason,
} from "./backend-session-policy";

function session(overrides: Partial<BackendSession> = {}): BackendSession {
  return {
    actorId: "actor-session-policy",
    tenantId: "tenant-session-policy",
    customerId: "customer-session-policy",
    environment: "SANDBOX",
    expiresAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("Canonical Backend session invalidation policy", () => {
  it("accepts only the five typed authoritative reasons", () => {
    expect(BACKEND_SESSION_INVALIDATION_REASONS).toEqual([
      "EXPLICIT_401",
      "EXPIRED",
      "REVOKED",
      "DISABLED",
      "ENVIRONMENT_MISMATCH",
    ]);
    for (const reason of BACKEND_SESSION_INVALIDATION_REASONS) {
      expect(isBackendSessionInvalidationReason(reason)).toBe(true);
    }
    for (const reason of [null, 401, "401", "HTTP_408", "RATE_LIMITED", "MODULE_FAILURE"]) {
      expect(isBackendSessionInvalidationReason(reason)).toBe(false);
    }
  });

  it("clears only the exact current Session object for every authoritative reason", () => {
    for (const reason of BACKEND_SESSION_INVALIDATION_REASONS) {
      const activeSession = session();
      expect(backendSessionAfterInvalidation(activeSession, activeSession, reason)).toBeNull();
    }
  });

  it("never lets an old request clear an equal-valued replacement Session", () => {
    for (const reason of BACKEND_SESSION_INVALIDATION_REASONS) {
      const oldSession = session();
      const replacementSession = { ...oldSession };
      expect(backendSessionAfterInvalidation(replacementSession, oldSession, reason)).toBe(
        replacementSession,
      );
    }
  });

  it("lets only the exact Session object and current request epoch commit", () => {
    const expectedSession = session();
    const replacementSession = { ...expectedSession };
    expect(backendSessionRequestCanCommit(expectedSession, expectedSession, 7, 7)).toBe(true);
    expect(backendSessionRequestCanCommit(replacementSession, expectedSession, 7, 7)).toBe(false);
    expect(backendSessionRequestCanCommit(expectedSession, expectedSession, 8, 7)).toBe(false);
    expect(backendSessionRequestCanCommit(null, null, 7, 7)).toBe(true);
    expect(backendSessionRequestCanCommit(null, null, 8, 7)).toBe(false);
  });

  it("retains the current Session for 408, 429, 5xx and module failures", () => {
    const activeSession = session();
    for (const reason of [408, 429, 500, 503, 599, "MODULE_FAILURE", new Error("module")]) {
      expect(backendSessionAfterInvalidation(activeSession, activeSession, reason)).toBe(
        activeSession,
      );
    }
  });

  it("maps only an explicit Backend 401 and never message text", () => {
    expect(
      backendSessionInvalidationReasonFromError(
        new BackendApiError(401, "trace-401", "Session disabled or revoked"),
      ),
    ).toBe("EXPLICIT_401");
    for (const reason of [
      new BackendApiError(408, "trace-408", "timeout"),
      new BackendApiError(429, "trace-429", "rate limited"),
      new BackendApiError(500, "trace-500", "Session revoked"),
      new Error("401 session disabled"),
    ]) {
      expect(backendSessionInvalidationReasonFromError(reason)).toBeNull();
    }
  });

  it("recognizes local expiry and runtime environment mismatch without widening", () => {
    const now = Date.parse("2026-08-02T12:00:00.000Z");
    expect(
      backendSessionIntrinsicInvalidationReason(
        session({ expiresAt: "2026-08-02T11:59:59.999Z" }),
        "SANDBOX",
        now,
      ),
    ).toBe("EXPIRED");
    expect(
      backendSessionIntrinsicInvalidationReason(session({ environment: "TEST" }), "SANDBOX", now),
    ).toBe("ENVIRONMENT_MISMATCH");
    for (const runtime of [undefined, "SANDBOX"] as const satisfies readonly (
      | FastLinkEnvironment
      | undefined
    )[]) {
      expect(
        backendSessionIntrinsicInvalidationReason(
          session({ expiresAt: "2026-08-02T12:00:00.001Z" }),
          runtime,
          now,
        ),
      ).toBeNull();
    }
  });
});
