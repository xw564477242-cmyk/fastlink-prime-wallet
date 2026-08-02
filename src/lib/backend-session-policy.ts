import { BackendApiError, type BackendSession, type FastLinkEnvironment } from "./backend-api";

export const BACKEND_SESSION_INVALIDATION_REASONS = [
  "EXPLICIT_401",
  "EXPIRED",
  "REVOKED",
  "DISABLED",
  "ENVIRONMENT_MISMATCH",
] as const;

export type BackendSessionInvalidationReason =
  (typeof BACKEND_SESSION_INVALIDATION_REASONS)[number];

export type BackendSessionInvalidator = (
  expectedSession: BackendSession,
  reason: BackendSessionInvalidationReason,
) => void;

export function isBackendSessionInvalidationReason(
  reason: unknown,
): reason is BackendSessionInvalidationReason {
  return (
    typeof reason === "string" &&
    (BACKEND_SESSION_INVALIDATION_REASONS as readonly string[]).includes(reason)
  );
}

export function backendSessionInvalidationReasonFromError(
  reason: unknown,
): BackendSessionInvalidationReason | null {
  return reason instanceof BackendApiError && reason.status === 401 ? "EXPLICIT_401" : null;
}

export function backendSessionIntrinsicInvalidationReason(
  session: BackendSession,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): "EXPIRED" | "ENVIRONMENT_MISMATCH" | null {
  if (runtimeEnvironment && session.environment !== runtimeEnvironment) {
    return "ENVIRONMENT_MISMATCH";
  }
  if (typeof session.expiresAt !== "string") return null;
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry <= now ? "EXPIRED" : null;
}

export function backendSessionAfterInvalidation(
  currentSession: BackendSession | null,
  expectedSession: BackendSession,
  reason: unknown,
): BackendSession | null {
  if (!isBackendSessionInvalidationReason(reason)) return currentSession;
  return currentSession === expectedSession ? null : currentSession;
}

export function backendSessionRequestCanCommit(
  currentSession: BackendSession | null,
  expectedSession: BackendSession | null,
  currentEpoch: number,
  requestEpoch: number,
): boolean {
  return currentEpoch === requestEpoch && currentSession === expectedSession;
}
