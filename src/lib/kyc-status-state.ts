import type { BackendSession, FastLinkEnvironment } from "./backend-api";

export const KYC_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export type KycStatusSnapshot = {
  status: KycStatus;
  reviewedAt: string | null;
};

export type KycStatusRuntime = {
  apiUrl: string;
  environment: FastLinkEnvironment | undefined;
  error: string | null;
};

export type KycStatusState = {
  scopeKey: string | null;
  activeRequestKey: string | null;
  snapshot: KycStatusSnapshot | null;
  loading: boolean;
  error: string | null;
};

export const initialKycStatusState: KycStatusState = {
  scopeKey: null,
  activeRequestKey: null,
  snapshot: null,
  loading: false,
  error: null,
};

const MAX_KYC_STATUS_BYTES = 4_096;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class KycStatusReadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KycStatusReadError";
  }
}

export function isKycStatusEnvironment(
  environment: FastLinkEnvironment | undefined,
): environment is "SANDBOX" | "TEST" {
  return environment === "SANDBOX" || environment === "TEST";
}

function hasVerifiedIdentity(session: BackendSession): boolean {
  return [session.actorId, session.tenantId, session.customerId].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function kycStatusSessionReadAllowed(
  session: BackendSession | null,
  runtime: KycStatusRuntime,
  now = Date.now(),
): session is BackendSession {
  if (
    !session ||
    runtime.error !== null ||
    runtime.apiUrl !== "/api" ||
    !isKycStatusEnvironment(runtime.environment) ||
    session.environment !== runtime.environment ||
    !hasVerifiedIdentity(session)
  ) {
    return false;
  }
  if (!session.expiresAt) return true;
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function isKycStatus(value: unknown): value is KycStatus {
  return typeof value === "string" && (KYC_STATUSES as readonly string[]).includes(value);
}

function isIsoUtcString(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  const normalized = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/, (_match, fraction: string) => `.${fraction.padEnd(3, "0")}Z`)
    : value.replace(/Z$/, ".000Z");
  return new Date(milliseconds).toISOString() === normalized;
}

export function parseKycStatusResponse(raw: string): KycStatusSnapshot {
  if (new TextEncoder().encode(raw).byteLength > MAX_KYC_STATUS_BYTES) {
    throw new KycStatusReadError("KYC status response is invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new KycStatusReadError("KYC status response is invalid");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new KycStatusReadError("KYC status response is invalid");
  }
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "reviewedAt,status" ||
    !isKycStatus(record.status) ||
    !(record.reviewedAt === null || isIsoUtcString(record.reviewedAt))
  ) {
    throw new KycStatusReadError("KYC status response is invalid");
  }

  return { status: record.status, reviewedAt: record.reviewedAt };
}

export async function fetchKycStatus(
  session: BackendSession,
  runtime: KycStatusRuntime,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<KycStatusSnapshot> {
  if (!kycStatusSessionReadAllowed(session, runtime)) {
    throw new KycStatusReadError("KYC status is unavailable in this environment");
  }

  const response = await fetcher("/api/v1/kyc/status", {
    method: "GET",
    headers: { accept: "application/json" },
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new KycStatusReadError("KYC status is unavailable", response.status);
  }
  return parseKycStatusResponse(await response.text());
}

export function kycStatusScopeKey(
  session: BackendSession | null,
  runtime: KycStatusRuntime,
): string | null {
  if (!kycStatusSessionReadAllowed(session, runtime)) return null;
  return JSON.stringify([
    session.actorId,
    session.tenantId,
    session.customerId,
    session.environment,
    session.expiresAt ?? null,
    runtime.apiUrl,
    runtime.environment,
  ]);
}

export function kycStatusRequestKey(scopeKey: string, generation: number): string {
  return JSON.stringify([scopeKey, generation]);
}

export function kycStatusErrorMessage(_reason: unknown): string {
  return "KYC status is temporarily unavailable";
}

export function kycStatusViewForScope(state: KycStatusState, scopeKey: string | null) {
  if (state.scopeKey === scopeKey) return { ...state, scopeReady: true };
  return { ...initialKycStatusState, scopeKey, scopeReady: false };
}

export type KycStatusAction =
  | { type: "reset"; scopeKey: string | null }
  | { type: "begin"; scopeKey: string; requestKey: string }
  | { type: "loaded"; requestKey: string; snapshot: KycStatusSnapshot }
  | { type: "failed"; requestKey: string; message: string }
  | { type: "settled"; requestKey: string };

export function kycStatusReducer(state: KycStatusState, action: KycStatusAction): KycStatusState {
  switch (action.type) {
    case "reset":
      return { ...initialKycStatusState, scopeKey: action.scopeKey };
    case "begin":
      return action.scopeKey === state.scopeKey
        ? { ...state, activeRequestKey: action.requestKey, loading: true, error: null }
        : state;
    case "loaded":
      return action.requestKey === state.activeRequestKey
        ? { ...state, snapshot: action.snapshot, error: null }
        : state;
    case "failed":
      return action.requestKey === state.activeRequestKey
        ? { ...state, error: action.message }
        : state;
    case "settled":
      return action.requestKey === state.activeRequestKey
        ? { ...state, activeRequestKey: null, loading: false }
        : state;
  }
}
