import {
  buildFxQuoteRequest,
  fxQuoteSameOriginApiAllowed,
  fxQuoteSessionAllowed,
  normalizeFxQuoteResponse,
  type FxQuote,
  type FxQuoteInput,
} from "./fx-quote-contract";

export type FastLinkEnvironment = "LOCAL" | "SANDBOX" | "TEST" | "UAT" | "PRODUCTION";

const allowedEnvironments: FastLinkEnvironment[] = [
  "LOCAL",
  "SANDBOX",
  "TEST",
  "UAT",
  "PRODUCTION",
];

const configuredApiUrl = (import.meta.env.VITE_FASTLINK_API_URL as string | undefined)?.trim();
const configuredEnvironment = (import.meta.env.VITE_FASTLINK_ENVIRONMENT as string | undefined)
  ?.trim()
  .toUpperCase() as FastLinkEnvironment | undefined;

function resolveRuntime() {
  if (!configuredApiUrl) {
    return {
      error: "Missing VITE_FASTLINK_API_URL",
      apiUrl: "",
      environment: configuredEnvironment,
    };
  }
  if (!configuredEnvironment || !allowedEnvironments.includes(configuredEnvironment)) {
    return {
      error: "VITE_FASTLINK_ENVIRONMENT must be LOCAL, SANDBOX, TEST, UAT, or PRODUCTION",
      apiUrl: configuredApiUrl,
      environment: configuredEnvironment,
    };
  }
  const apiUrl = configuredApiUrl.replace(/\/+$/, "");
  if (
    configuredEnvironment === "PRODUCTION" &&
    !apiUrl.startsWith("https://") &&
    !apiUrl.startsWith("/")
  ) {
    return {
      error: "Production Backend API must use HTTPS",
      apiUrl,
      environment: configuredEnvironment,
    };
  }
  return { apiUrl, environment: configuredEnvironment, error: null };
}

export const backendRuntime = Object.freeze({
  ...resolveRuntime(),
  buildSha: (import.meta.env.VITE_FASTLINK_BUILD_SHA as string | undefined)?.trim() || "unknown",
});

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly traceId: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export type BackendSession = {
  actorId: string;
  tenantId: string;
  customerId: string;
  environment: FastLinkEnvironment;
  expiresAt?: string;
};

export type BackendCredentials = {
  tenantId: string;
  email: string;
  password: string;
};

export type WalletCard = {
  cardId: string;
  type: "virtual" | "physical" | "travel";
  status: "active" | "frozen" | "pending" | "closed" | "failed";
  last4: string;
  expiry: string;
  expiryMonth?: number;
  expiryYear?: number;
  currency: string;
  alias?: string;
  balance: number;
  availableBalanceMinor?: string;
  createdAt?: string;
  capabilities: {
    freeze: boolean;
    unfreeze: boolean;
    replace: boolean;
    renew: boolean;
    updateLimits: boolean;
  };
};

export type VirtualCardCreateInput = {
  currency: string;
  alias?: string;
};

export type CardStatusMutationAction = "freeze" | "unfreeze";

export const CARD_REPLACEMENT_REASONS = ["LOST", "STOLEN", "DAMAGED", "OTHER"] as const;
export type CardReplacementReason = (typeof CARD_REPLACEMENT_REASONS)[number];

export function isCardReplacementReason(value: unknown): value is CardReplacementReason {
  return (
    typeof value === "string" && (CARD_REPLACEMENT_REASONS as readonly string[]).includes(value)
  );
}

export function isVirtualCardCreateEnvironment(
  environment: FastLinkEnvironment | undefined,
): environment is "SANDBOX" | "TEST" {
  return environment === "SANDBOX" || environment === "TEST";
}

export type WalletCardPage = {
  cards: WalletCard[];
  nextCursor: string | null;
};

export type WalletCardListQuery = {
  limit?: number;
  cursor?: string;
};

export type WalletCardBalance = {
  cardId: string;
  currency: string;
  availableBalanceMinor: string;
  currentBalanceMinor: string;
  pendingAmountMinor: string;
  updatedAt: string;
};

export type WalletCardLimits = {
  cardId: string;
  singleTransactionMinor: string | null;
  dailySpendMinor: string | null;
  monthlySpendMinor: string | null;
  dailyAtmMinor: string | null;
  updatedAt: string | null;
};

export const CARD_LIMIT_UPDATE_MAX_MINOR = 9_000_000_000_000;
export const CARD_LIMIT_FIELDS = [
  "singleTransactionMinor",
  "dailySpendMinor",
  "monthlySpendMinor",
  "dailyAtmMinor",
] as const;
export type CardLimitField = (typeof CARD_LIMIT_FIELDS)[number];
export type CardLimitsUpdateInput = Partial<Record<CardLimitField, number>>;

export const CARD_LIST_PAGE_SIZE = 20;
export const CARD_ACTIVATION_MAX_RESPONSE_BYTES = 16_384;

export type WalletCardTransaction = {
  id: string;
  status: "authorized" | "declined" | "cleared" | "settled" | "reversed" | "refunded";
  amountMinor: string;
  currency: string;
  merchant: string;
  category: string;
  timestamp: string;
};

export type WalletCardTransactionPage = {
  transactions: WalletCardTransaction[];
  nextCursor: string | null;
};

export type WalletCardTransactionQuery = {
  limit?: number;
  cursor?: string;
  status?: CardTransactionStatusFilter;
};

export type WalletCardTransactionDetailExpectation = {
  cardId: string;
  transactionId: string;
  currency: string;
  occurredAt: string;
};

export const CARD_TRANSACTION_STATUSES = [
  "AUTHORIZED",
  "CLEARED",
  "SETTLED",
  "DECLINED",
  "REVERSED",
  "REFUNDED",
] as const;
export type CardTransactionStatusFilter = (typeof CARD_TRANSACTION_STATUSES)[number];
export const CARD_TRANSACTION_FILTERS = ["ALL", ...CARD_TRANSACTION_STATUSES] as const;
export type CardTransactionFilter = (typeof CARD_TRANSACTION_FILTERS)[number];
export const CARD_TRANSACTION_FILTER_VERSION = 1;

export function isCardTransactionFilter(value: unknown): value is CardTransactionFilter {
  return (
    typeof value === "string" && (CARD_TRANSACTION_FILTERS as readonly string[]).includes(value)
  );
}

export const CARD_TRANSACTION_PAGE_SIZE = 25;
export const CARD_TRANSACTION_MAX_JSON_BYTES = 65_536;
export const CARD_TRANSACTION_MAX_CURSOR_BYTES = 16_384;
export const CARD_TIMELINE_PAGE_SIZE = 25;
export const CARD_TIMELINE_MAX_PAGES = 10;
export const CARD_TIMELINE_MAX_JSON_BYTES = 65_536;
export const CARD_TIMELINE_MAX_CURSOR_BYTES = 2_048;
export const CARD_TIMELINE_TYPES = [
  "CREATED",
  "ACTIVATED",
  "FROZEN",
  "UNFROZEN",
  "REPLACED",
  "RENEWED",
  "LIMITS_UPDATED",
  "PIN_UPDATED",
  "VIEWED",
  "STATUS_CHANGED",
  "UPDATED",
] as const;
export const CARD_TIMELINE_STATUSES = ["PENDING", "ACTIVE", "FROZEN", "CLOSED", "FAILED"] as const;
export type CardTimelineType = (typeof CARD_TIMELINE_TYPES)[number];
export type CardTimelineStatus = (typeof CARD_TIMELINE_STATUSES)[number];
export type WalletCardTimelineEvent = Readonly<{
  id: string;
  type: CardTimelineType;
  fromStatus: CardTimelineStatus | null;
  toStatus: CardTimelineStatus | null;
  occurredAt: string;
}>;
export type WalletCardTimelinePage = Readonly<{
  events: readonly WalletCardTimelineEvent[];
  nextCursor: string | null;
}>;
export type WalletCardTimelineQuery = Readonly<{
  limit?: number;
  cursor?: string;
}>;
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function isCanonicalBase64UrlSegment(value: string): boolean {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const remainder = value.length % 4;
  if (remainder === 1) return false;
  if (remainder === 0) return true;
  const lastValue = BASE64URL_ALPHABET.indexOf(value[value.length - 1] ?? "");
  return remainder === 2 ? lastValue % 16 === 0 : lastValue % 4 === 0;
}

function isCanonicalCardTransactionCursor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > CARD_TRANSACTION_MAX_CURSOR_BYTES) return false;
  const segments = value.split(".");
  return segments.length === 2 && segments.every(isCanonicalBase64UrlSegment);
}

type CardTimelineCursorPosition = Readonly<{
  id: string;
  occurredAt: string;
}>;

function decodeBase64UrlSegment(value: string): Uint8Array | null {
  if (!isCanonicalBase64UrlSegment(value)) return null;
  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const decoded = globalThis.atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function cardTimelineCursorPosition(value: unknown): CardTimelineCursorPosition | null {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > CARD_TIMELINE_MAX_CURSOR_BYTES
  ) {
    return null;
  }
  const segments = value.split(".");
  if (segments.length !== 2) return null;
  const payloadBytes = decodeBase64UrlSegment(segments[0]);
  const macBytes = decodeBase64UrlSegment(segments[1]);
  if (!payloadBytes || !macBytes || macBytes.byteLength !== 32) return null;
  try {
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes),
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed).sort();
    if (keys.join("\n") !== ["i", "k", "t", "v"].join("\n")) return null;
    const payload = parsed as { v?: unknown; t?: unknown; k?: unknown; i?: unknown };
    if (
      payload.v !== 1 ||
      (payload.k !== "LIFECYCLE" && payload.k !== "EVENT") ||
      typeof payload.i !== "string" ||
      !/^[A-Za-z0-9_-]{2,128}$/.test(payload.i) ||
      typeof payload.t !== "string"
    ) {
      return null;
    }
    const timestamp = new Date(payload.t);
    if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString() !== payload.t) return null;
    return Object.freeze({ id: payload.i, occurredAt: payload.t });
  } catch {
    return null;
  }
}

function isCanonicalCardTimelineCursor(value: unknown): value is string {
  return cardTimelineCursorPosition(value) !== null;
}

export type WalletAssetAccount = {
  assetCode: string;
  availableBalance: string;
  ledgerBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

export const WALLET_BALANCE_SUMMARY_PATH = "/v1/wallet/balances";
export const WALLET_BALANCE_SUMMARY_MAX_ITEMS = 50;
export const WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES = 32_768;

export type WalletTransferAccount = {
  id: string;
  assetCode: string;
  status: "active" | "frozen" | "closed";
  currentBalance: string;
  postedBalance: string;
  pendingBalance: string;
  availableBalance: string;
  updatedAt: string;
};

export type WalletTransferInput = {
  destinationAccountId: string;
  amount: string;
};

export const WALLET_TRANSFER_ACCOUNT_MAX_ITEMS = 100;
export const WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES = 65_536;
export const WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES = 16_384;

export type WalletAccountTransaction = {
  id: string;
  type: "deposit" | "withdrawal" | "transfer" | "merchant_payment" | "refund" | "fx";
  status: "pending" | "completed" | "failed" | "reversed";
  assetCode: string;
  amount: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
  updatedAt: string;
};

export type WalletAccountTransactionPage = {
  items: WalletAccountTransaction[];
  nextCursor: string | null;
};

export const WALLET_TRANSACTION_TYPES = [
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER",
  "MERCHANT_PAYMENT",
  "REFUND",
  "FX",
] as const;
export type WalletTransactionTypeFilter = (typeof WALLET_TRANSACTION_TYPES)[number];

export const WALLET_TRANSACTION_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;
export type WalletTransactionStatusFilter = (typeof WALLET_TRANSACTION_STATUSES)[number];
export const WALLET_TRANSACTION_FILTER_VERSION = 1;
export const WALLET_TRANSACTION_MAX_JSON_BYTES = 65_536;
export const WALLET_TRANSACTION_MAX_CURSOR_LENGTH = 512;

export type WalletAccountTransactionQuery = {
  assetCode: string;
  type?: WalletTransactionTypeFilter;
  status?: WalletTransactionStatusFilter;
  limit?: number;
  cursor?: string;
};

export type WalletTransactionDetailExpectation = {
  transactionId: string;
  assetCode: string;
  amount: string;
};

export type WalletOperationActivity = {
  id: string;
  type: "deposit" | "internal_transfer" | "withdrawal" | "fx_conversion";
  status: "processing" | "pending_settlement" | "completed" | "failed";
  assetCode: string;
  amount: string;
  direction: "outgoing" | "incoming" | "between_own_accounts";
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type WalletOperationActivityPage = {
  items: WalletOperationActivity[];
  nextCursor: string | null;
};

export const WALLET_OPERATION_TYPES = [
  "DEPOSIT",
  "INTERNAL_TRANSFER",
  "WITHDRAWAL",
  "FX_CONVERSION",
] as const;
export const WALLET_OPERATION_STATUSES = [
  "PROCESSING",
  "PENDING_SETTLEMENT",
  "COMPLETED",
  "FAILED",
] as const;
export type WalletOperationTypeFilter = (typeof WALLET_OPERATION_TYPES)[number];
export type WalletOperationStatusFilter = (typeof WALLET_OPERATION_STATUSES)[number];
export const WALLET_OPERATION_FILTER_VERSION = 1;

export type WalletOperationActivityQuery = {
  limit?: number;
  cursor?: string;
  type?: WalletOperationTypeFilter;
  status?: WalletOperationStatusFilter;
};

export type WalletOperationDetailExpectation = {
  operationId: string;
};

export type WalletTransferStatusExpectation = {
  previous: WalletOperationActivity;
};

export const WALLET_OPERATION_PAGE_SIZE = 25;

export const WALLET_TRANSACTION_PAGE_SIZE = 25;

type BackendCardRecord = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  last4?: unknown;
  expiryMonth?: unknown;
  expiryYear?: unknown;
  currency?: unknown;
  alias?: unknown;
  availableBalanceMinor?: unknown;
  createdAt?: unknown;
  capabilities?: Record<string, unknown>;
};

type BackendCardPageRecord = {
  cards?: unknown;
  nextCursor?: unknown;
};

type BackendWalletBalanceRecord = {
  assetCode?: unknown;
  availableBalance?: unknown;
  ledgerBalance?: unknown;
  pendingBalance?: unknown;
  updatedAt?: unknown;
};

type BackendWalletTransactionRecord = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  assetCode?: unknown;
  amount?: unknown;
  direction?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type BackendWalletTransactionPageRecord = {
  items?: unknown;
  nextCursor?: unknown;
};

function traceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `fl-${Date.now()}-${Math.random()}`;
}

function requireRuntime(): { apiUrl: string; environment: FastLinkEnvironment } {
  if (backendRuntime.error || !backendRuntime.apiUrl || !backendRuntime.environment) {
    throw new BackendApiError(0, "runtime", backendRuntime.error ?? "Invalid wallet runtime");
  }
  return {
    apiUrl: backendRuntime.apiUrl,
    environment: backendRuntime.environment,
  };
}

function requireSandboxTestCardMutationRuntime(): void {
  const { environment } = requireRuntime();
  if (!isVirtualCardCreateEnvironment(environment)) {
    throw new BackendApiError(0, "runtime", "Card mutations are disabled outside SANDBOX and TEST");
  }
}

export function cardActivationSessionAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  runtimeApiUrl: string,
  now = Date.now(),
): boolean {
  if (
    runtimeApiUrl !== "/api" ||
    !session ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string" ||
    ![session.actorId, session.tenantId, session.customerId].every(
      (value) => typeof value === "string" && value.length >= 2 && value.length <= 512,
    )
  ) {
    return false;
  }
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function requireCardActivationRuntime(session: BackendSession): void {
  const { apiUrl, environment } = requireRuntime();
  if (!cardActivationSessionAllowed(session, environment, apiUrl)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Card activation requires same-origin /api and a matching, unexpired SANDBOX or TEST session",
    );
  }
}

export function walletTransferSessionAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): boolean {
  if (
    !session ||
    session.environment !== runtimeEnvironment ||
    !isVirtualCardCreateEnvironment(runtimeEnvironment) ||
    typeof session.expiresAt !== "string"
  ) {
    return false;
  }
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

export function walletTransferAccountReadAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  apiUrl: string,
  now = Date.now(),
): boolean {
  return apiUrl === "/api" && walletTransferSessionAllowed(session, runtimeEnvironment, now);
}

function requireSandboxTestWalletAccountReadRuntime(session: BackendSession): void {
  const { apiUrl, environment } = requireRuntime();
  if (!walletTransferAccountReadAllowed(session, environment, apiUrl)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Wallet account reads require same-origin /api and a matching, unexpired SANDBOX or TEST session",
    );
  }
}

function requireSandboxTestWalletRuntime(session: BackendSession): void {
  const { environment } = requireRuntime();
  if (!walletTransferSessionAllowed(session, environment)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Wallet transfers require a matching, unexpired SANDBOX or TEST session",
    );
  }
}

export function walletBalanceSummaryReadAllowed(
  sessionEnvironment: FastLinkEnvironment,
  runtimeEnvironment: FastLinkEnvironment | undefined,
): boolean {
  return (
    sessionEnvironment === runtimeEnvironment &&
    (runtimeEnvironment === "SANDBOX" || runtimeEnvironment === "TEST")
  );
}

function requireSandboxTestWalletBalanceRuntime(sessionEnvironment: FastLinkEnvironment): void {
  const { environment } = requireRuntime();
  if (!walletBalanceSummaryReadAllowed(sessionEnvironment, environment)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Wallet balance summary is available only in the matching SANDBOX or TEST session",
    );
  }
}

export function walletTransactionReadAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): boolean {
  if (
    !session ||
    session.environment !== runtimeEnvironment ||
    (runtimeEnvironment !== "SANDBOX" && runtimeEnvironment !== "TEST") ||
    typeof session.expiresAt !== "string"
  ) {
    return false;
  }
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function requireSandboxTestWalletTransactionRuntime(session: BackendSession): void {
  const { environment } = requireRuntime();
  if (!walletTransactionReadAllowed(session, environment)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Wallet transactions are available only in a matching, unexpired SANDBOX or TEST session",
    );
  }
}

export function cardTransactionReadAllowed(
  sessionEnvironment: FastLinkEnvironment,
  runtimeEnvironment: FastLinkEnvironment | undefined,
): boolean {
  return (
    sessionEnvironment === runtimeEnvironment &&
    (runtimeEnvironment === "SANDBOX" || runtimeEnvironment === "TEST")
  );
}

export function cardTransactionSessionReadAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  now = Date.now(),
): boolean {
  if (
    !session ||
    !cardTransactionReadAllowed(session.environment, runtimeEnvironment) ||
    typeof session.expiresAt !== "string"
  ) {
    return false;
  }
  const expiry = Date.parse(session.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function requireSandboxTestCardTransactionRuntime(session: BackendSession): void {
  const { environment } = requireRuntime();
  if (!cardTransactionSessionReadAllowed(session, environment)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Card transactions are available only in a matching, unexpired SANDBOX or TEST session",
    );
  }
}

export function cardTimelineSessionReadAllowed(
  session: BackendSession | null,
  runtimeEnvironment: FastLinkEnvironment | undefined,
  runtimeApiUrl: string,
  now = Date.now(),
): boolean {
  return (
    runtimeApiUrl === "/api" &&
    Boolean(
      session &&
      [session.actorId, session.tenantId, session.customerId].every(
        (value) => typeof value === "string" && value.length >= 2 && value.length <= 512,
      ),
    ) &&
    cardTransactionSessionReadAllowed(session, runtimeEnvironment, now)
  );
}

function requireSandboxTestCardTimelineRuntime(session: BackendSession): void {
  const { environment, apiUrl } = requireRuntime();
  if (!cardTimelineSessionReadAllowed(session, environment, apiUrl)) {
    throw new BackendApiError(
      0,
      "runtime",
      "Card timeline is available only through same-origin /api in a matching, unexpired SANDBOX or TEST session",
    );
  }
}

function parseMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join(", ");
  return typeof message === "string" && message.trim() ? message : fallback;
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("fastlink_csrf="));
  return match ? decodeURIComponent(match.slice("fastlink_csrf=".length)) : "";
}

async function boundedResponseText(response: Response, maximumBytes: number): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maximumBytes) {
      await response.body?.cancel();
      throw new Error("Backend response exceeds the consumer limit");
    }
  }
  if (!response.body) {
    const value = await response.text();
    if (new TextEncoder().encode(value).byteLength > maximumBytes) {
      throw new Error("Backend response exceeds the consumer limit");
    }
    return value;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let value = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel();
        throw new Error("Backend response exceeds the consumer limit");
      }
      value += decoder.decode(chunk.value, { stream: true });
    }
    return value + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  responseMode: "json" | "text" = "json",
  maximumResponseBytes?: number,
): Promise<T> {
  const runtime = requireRuntime();
  const requestTraceId = traceId();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Trace-Id", requestTraceId);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const controller = new AbortController();
  const externalSignal = init.signal ?? undefined;
  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${runtime.apiUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    const returnedTraceId = response.headers.get("x-trace-id") || requestTraceId;
    const payload =
      responseMode === "text"
        ? maximumResponseBytes === undefined
          ? await response.text().catch(() => "")
          : response.ok
            ? await boundedResponseText(response, maximumResponseBytes)
            : await boundedResponseText(response, maximumResponseBytes).catch(() => "")
        : await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = `Backend request failed with HTTP ${response.status}`;
      let errorPayload: unknown = payload;
      if (responseMode === "text") {
        try {
          errorPayload = JSON.parse(payload as string);
        } catch {
          errorPayload = null;
        }
      }
      throw new BackendApiError(
        response.status,
        returnedTraceId,
        `${parseMessage(errorPayload, fallback)} · Trace ${returnedTraceId}`,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BackendApiError(408, requestTraceId, `Backend timeout · Trace ${requestTraceId}`);
    }
    const message = error instanceof Error ? error.message : "Backend network failure";
    throw new BackendApiError(0, requestTraceId, `${message} · Trace ${requestTraceId}`);
  } finally {
    globalThis.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function normalizeStatus(value: unknown): WalletCard["status"] {
  const status = String(value ?? "").toLowerCase();
  if (["active", "frozen", "pending", "closed", "failed"].includes(status)) {
    return status as WalletCard["status"];
  }
  return "pending";
}

function normalizeCard(value: BackendCardRecord): WalletCard {
  const id = typeof value.id === "string" ? value.id : "";
  if (!id) throw new Error("Backend returned a card without an id");
  const rawType = String(value.type ?? "").toLowerCase();
  const type = ["virtual", "physical", "travel"].includes(rawType)
    ? (rawType as WalletCard["type"])
    : "virtual";
  const month = Number(value.expiryMonth);
  const year = Number(value.expiryYear);
  const expiryValid =
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 9999;
  const availableBalanceMinor =
    value.availableBalanceMinor === undefined
      ? undefined
      : cardMinorUnits(value.availableBalanceMinor, "available balance");
  const minor = Number(availableBalanceMinor ?? 0);
  const hasAlias = Object.hasOwn(value, "alias");
  const alias =
    value.alias === null ? undefined : typeof value.alias === "string" ? value.alias : undefined;
  const createdAt = value.createdAt === undefined ? undefined : cardRfc3339(value.createdAt);
  const capabilities = value.capabilities ?? {};

  return {
    cardId: id,
    type,
    status: normalizeStatus(value.status),
    last4: typeof value.last4 === "string" ? value.last4 : "",
    expiry: expiryValid ? `${String(month).padStart(2, "0")}/${String(year).slice(-2)}` : "—",
    expiryMonth: expiryValid ? month : undefined,
    expiryYear: expiryValid ? year : undefined,
    currency: typeof value.currency === "string" ? value.currency : "—",
    ...(hasAlias ? { alias } : {}),
    balance: Number.isFinite(minor) ? minor / 100 : 0,
    ...(availableBalanceMinor === undefined ? {} : { availableBalanceMinor }),
    ...(createdAt === undefined ? {} : { createdAt }),
    capabilities: {
      freeze: capabilities.freeze === true,
      unfreeze: capabilities.unfreeze === true,
      replace: capabilities.replace === true,
      renew: capabilities.renew === true,
      updateLimits: capabilities.updateLimits === true,
    },
  };
}

export function normalizeCardListResponse(
  value: unknown,
  limit = CARD_LIST_PAGE_SIZE,
): WalletCardPage {
  if (Array.isArray(value)) {
    return {
      cards: value.slice(0, limit).map((card) => normalizeCard(card as BackendCardRecord)),
      nextCursor: null,
    };
  }
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid card list page");
  }
  const page = value as BackendCardPageRecord;
  if (!Array.isArray(page.cards)) {
    throw new Error("Backend returned an invalid card list page");
  }
  if (
    page.nextCursor !== null &&
    (typeof page.nextCursor !== "string" ||
      page.nextCursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))
  ) {
    throw new Error("Backend returned an invalid card list cursor");
  }
  return {
    cards: page.cards.slice(0, limit).map((card) => normalizeCard(card as BackendCardRecord)),
    nextCursor: page.nextCursor,
  };
}

export function buildCardListPath(query: WalletCardListQuery = {}): string {
  const limit = query.limit ?? CARD_LIST_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Card list limit must be between 1 and 50");
  }
  if (
    query.cursor !== undefined &&
    (query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
  ) {
    throw new Error("Invalid card list cursor");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/cards?${params.toString()}`;
}

function cardPublicId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{2,128}$/.test(value)) {
    throw new Error("Backend returned an invalid Card id");
  }
  return value;
}

function cardMinorUnits(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^(?:0|-?[1-9]\d{0,18})$/.test(value)) {
    throw new Error(`Backend returned an invalid Card ${field}`);
  }
  const amount = BigInt(value);
  if (amount < -9_223_372_036_854_775_808n || amount > 9_223_372_036_854_775_807n) {
    throw new Error(`Backend returned an invalid Card ${field}`);
  }
  return value;
}

function cardCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    throw new Error("Backend returned an invalid Card balance currency");
  }
  return value;
}

function cardRfc3339(value: unknown): string {
  if (typeof value !== "string" || value.length > 64) {
    throw new Error("Backend returned an invalid Card balance timestamp");
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) throw new Error("Backend returned an invalid Card balance timestamp");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[7] ?? 0);
  const offsetMinute = Number(match[8] ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Backend returned an invalid Card balance timestamp");
  }
  return value;
}

function cardNullableLimit(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,18})$/.test(value)) {
    throw new Error(`Backend returned an invalid Card ${field}`);
  }
  if (BigInt(value) > 9_223_372_036_854_775_807n) {
    throw new Error(`Backend returned an invalid Card ${field}`);
  }
  return value;
}

function ownJsonDataRecord(
  value: unknown,
  fields: readonly string[],
  errorMessage: string,
  fieldErrorMessage?: (field: string) => string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(errorMessage);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const record: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !("value" in descriptor)) {
      throw new Error(fieldErrorMessage?.(field) ?? errorMessage);
    }
    record[field] = descriptor.value;
  }
  return record;
}

function exactOwnJsonDataRecord(
  value: unknown,
  fields: readonly string[],
  errorMessage: string,
): Record<string, unknown> {
  // This high-risk response is accepted only as raw JSON text. JSON.parse gives
  // us a provenance-safe ordinary data container, so hostile object inputs are
  // rejected without invoking getters or Proxy traps.
  if (typeof value !== "string") {
    throw new Error(errorMessage);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(errorMessage);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(errorMessage);
  }

  // structuredClone rejects Proxy containers without invoking their traps. Keep
  // this cloneability boundary ahead of every reflective operation below.
  try {
    if (typeof structuredClone !== "function") throw new Error("unavailable");
    structuredClone(parsed);
  } catch {
    throw new Error(errorMessage);
  }

  let descriptors: PropertyDescriptorMap;
  let ownKeys: (string | symbol)[];
  try {
    if (Object.getPrototypeOf(parsed) !== Object.prototype) throw new Error(errorMessage);
    descriptors = Object.getOwnPropertyDescriptors(parsed);
    ownKeys = Reflect.ownKeys(parsed);
  } catch {
    throw new Error(errorMessage);
  }
  if (ownKeys.some((key) => typeof key !== "string")) throw new Error(errorMessage);
  const actualFields = ownKeys.slice().sort() as string[];
  const expectedFields = [...fields].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    throw new Error(errorMessage);
  }
  const record: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !("value" in descriptor)) throw new Error(errorMessage);
    record[field] = descriptor.value;
  }
  return record;
}

function ownJsonArray(value: unknown, errorMessage: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new Error(errorMessage);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const items: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) {
      throw new Error(errorMessage);
    }
    items.push(descriptor.value);
  }
  return items;
}

function virtualCardAlias(value: unknown, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 64 ||
    value !== value.trim() ||
    !/^[\p{L}\p{N} ._-]+$/u.test(value)
  ) {
    throw new Error("Invalid Virtual Card alias");
  }
  return value;
}

export function normalizeVirtualCardCreateInput(input: unknown): VirtualCardCreateInput {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new Error("Invalid Virtual Card request");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const currencyDescriptor = descriptors.currency;
  if (!currencyDescriptor || !("value" in currencyDescriptor)) {
    throw new Error("Invalid Virtual Card currency");
  }
  const currency = currencyDescriptor.value;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Invalid Virtual Card currency");
  }
  const aliasDescriptor = descriptors.alias;
  if (aliasDescriptor && !("value" in aliasDescriptor)) {
    throw new Error("Invalid Virtual Card alias");
  }
  const alias = virtualCardAlias(aliasDescriptor?.value, false);
  return alias === undefined ? { currency } : { currency, alias };
}

export function validateVirtualCardIdempotencyKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  ) {
    throw new Error("Invalid Virtual Card idempotency key");
  }
  return value;
}

export function buildVirtualCardCreateRequest(
  input: VirtualCardCreateInput,
  idempotencyKey: string,
): { path: "/v1/cards/virtual"; init: RequestInit } {
  const normalizedInput = normalizeVirtualCardCreateInput(input);
  return {
    path: "/v1/cards/virtual",
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
      body: JSON.stringify(normalizedInput),
    },
  };
}

function strictCardCapabilities(value: unknown): WalletCard["capabilities"] {
  const record = ownJsonDataRecord(
    value,
    ["freeze", "unfreeze", "replace", "renew", "updateLimits"],
    "Backend returned invalid Virtual Card capabilities",
  );
  for (const capability of Object.values(record)) {
    if (typeof capability !== "boolean") {
      throw new Error("Backend returned invalid Virtual Card capabilities");
    }
  }
  return {
    freeze: record.freeze as boolean,
    unfreeze: record.unfreeze as boolean,
    replace: record.replace as boolean,
    renew: record.renew as boolean,
    updateLimits: record.updateLimits as boolean,
  };
}

export function normalizeVirtualCardCreateResponse(value: unknown): WalletCard {
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "last4",
      "expiryMonth",
      "expiryYear",
      "currency",
      "alias",
      "availableBalanceMinor",
      "createdAt",
      "capabilities",
    ],
    "Backend returned an invalid Virtual Card",
  );
  if (record.type !== "VIRTUAL") {
    throw new Error("Backend returned an invalid Virtual Card type");
  }
  if (
    typeof record.status !== "string" ||
    !["ACTIVE", "FROZEN", "PENDING", "CLOSED", "FAILED"].includes(record.status)
  ) {
    throw new Error("Backend returned an invalid Virtual Card status");
  }
  if (typeof record.last4 !== "string" || !/^\d{4}$/.test(record.last4)) {
    throw new Error("Backend returned an invalid Virtual Card last4");
  }
  if (
    typeof record.expiryMonth !== "number" ||
    !Number.isInteger(record.expiryMonth) ||
    record.expiryMonth < 1 ||
    record.expiryMonth > 12 ||
    typeof record.expiryYear !== "number" ||
    !Number.isInteger(record.expiryYear) ||
    record.expiryYear < 2000 ||
    record.expiryYear > 9999
  ) {
    throw new Error("Backend returned an invalid Virtual Card expiry");
  }
  const availableBalanceMinor = cardMinorUnits(record.availableBalanceMinor, "available balance");
  return {
    cardId: cardPublicId(record.id),
    type: "virtual",
    status: record.status.toLowerCase() as WalletCard["status"],
    last4: record.last4,
    expiry: `${String(record.expiryMonth).padStart(2, "0")}/${String(record.expiryYear).slice(-2)}`,
    expiryMonth: record.expiryMonth,
    expiryYear: record.expiryYear,
    currency: cardCurrency(record.currency),
    alias: virtualCardAlias(record.alias, true),
    balance: Number(availableBalanceMinor) / 100,
    availableBalanceMinor,
    createdAt: cardRfc3339(record.createdAt),
    capabilities: strictCardCapabilities(record.capabilities),
  };
}

function cardStatusMutationExpectation(card: WalletCard, action: CardStatusMutationAction) {
  const cardId = cardPublicId(card.cardId);
  if (
    (card.type !== "virtual" && card.type !== "physical") ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency) ||
    !Number.isInteger(card.expiryMonth) ||
    card.expiryMonth === undefined ||
    card.expiryMonth < 1 ||
    card.expiryMonth > 12 ||
    !Number.isInteger(card.expiryYear) ||
    card.expiryYear === undefined ||
    card.expiryYear < 2000 ||
    card.expiryYear > 9999 ||
    card.expiry !==
      `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}` ||
    !Number.isFinite(card.balance) ||
    (action === "freeze"
      ? card.status !== "active" || card.capabilities.freeze !== true
      : card.status !== "frozen" || card.capabilities.unfreeze !== true)
  ) {
    throw new Error("Selected Card status cannot be updated");
  }
  const alias = card.alias === undefined ? undefined : virtualCardAlias(card.alias, true);
  const availableBalanceMinor =
    card.availableBalanceMinor === undefined
      ? null
      : cardMinorUnits(card.availableBalanceMinor, "available balance");
  const createdAt = card.createdAt === undefined ? null : cardRfc3339(card.createdAt);
  if (
    availableBalanceMinor !== null &&
    !Object.is(card.balance, Number(availableBalanceMinor) / 100)
  ) {
    throw new Error("Selected Card status cannot be updated");
  }
  return { cardId, alias, availableBalanceMinor, createdAt };
}

export function buildCardStatusMutationRequest(
  card: WalletCard,
  action: CardStatusMutationAction,
  idempotencyKey: string,
  signal?: AbortSignal,
): { path: string; init: RequestInit } {
  const { cardId } = cardStatusMutationExpectation(card, action);
  return {
    path: `/v1/cards/${encodeURIComponent(cardId)}/${action}`,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
      ...(signal ? { signal } : {}),
    },
  };
}

export class CardStatusMutationConfirmationError extends Error {
  constructor() {
    super("Backend did not confirm the Card status update");
    this.name = "CardStatusMutationConfirmationError";
  }
}

function hasSameCardStatusOptionalField(
  candidate: WalletCard,
  expected: WalletCard,
  field: "alias" | "availableBalanceMinor" | "createdAt",
): boolean {
  return (
    Object.hasOwn(candidate, field) === Object.hasOwn(expected, field) &&
    candidate[field] === expected[field]
  );
}

function hasSameCardStatusGeneration(candidate: WalletCard, expected: WalletCard): boolean {
  return (
    candidate.cardId === expected.cardId &&
    candidate.type === expected.type &&
    candidate.status === expected.status &&
    candidate.last4 === expected.last4 &&
    candidate.expiry === expected.expiry &&
    candidate.expiryMonth === expected.expiryMonth &&
    candidate.expiryYear === expected.expiryYear &&
    candidate.currency === expected.currency &&
    Object.is(candidate.balance, expected.balance) &&
    hasSameCardStatusOptionalField(candidate, expected, "alias") &&
    hasSameCardStatusOptionalField(candidate, expected, "availableBalanceMinor") &&
    hasSameCardStatusOptionalField(candidate, expected, "createdAt") &&
    candidate.capabilities.freeze === expected.capabilities.freeze &&
    candidate.capabilities.unfreeze === expected.capabilities.unfreeze &&
    candidate.capabilities.replace === expected.capabilities.replace &&
    candidate.capabilities.renew === expected.capabilities.renew &&
    candidate.capabilities.updateLimits === expected.capabilities.updateLimits
  );
}

export function normalizeCardStatusMutationSnapshot(
  value: unknown,
  priorCard: WalletCard,
  action: CardStatusMutationAction,
  expectedGeneration: WalletCard,
): WalletCard {
  const record = exactOwnJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "last4",
      "expiryMonth",
      "expiryYear",
      "currency",
      "alias",
      "availableBalanceMinor",
      "createdAt",
      "capabilities",
    ],
    "Backend returned an invalid Card status snapshot",
  );
  const snapshot = normalizeCardStatusMutationResponse(record, priorCard, action);
  if (!hasSameCardStatusGeneration(snapshot, expectedGeneration)) {
    throw new CardStatusMutationConfirmationError();
  }
  return snapshot;
}

export function normalizeCardStatusMutationResponse(
  value: unknown,
  expectedCard: WalletCard,
  action: CardStatusMutationAction,
): WalletCard {
  const expectation = cardStatusMutationExpectation(expectedCard, action);
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "last4",
      "expiryMonth",
      "expiryYear",
      "currency",
      "alias",
      "availableBalanceMinor",
      "createdAt",
      "capabilities",
    ],
    "Backend returned an invalid Card status update",
  );
  const type =
    record.type === "VIRTUAL" ? "virtual" : record.type === "PHYSICAL" ? "physical" : null;
  const status = action === "freeze" ? "frozen" : "active";
  const alias =
    record.alias === null
      ? undefined
      : virtualCardAlias(record.alias, expectation.alias !== undefined);
  const availableBalanceMinor = cardMinorUnits(record.availableBalanceMinor, "available balance");
  const createdAt = record.createdAt === null ? undefined : cardRfc3339(record.createdAt);
  const capabilities = strictCardCapabilities(record.capabilities);
  if (
    record.id !== expectation.cardId ||
    type !== expectedCard.type ||
    record.status !== status.toUpperCase() ||
    record.last4 !== expectedCard.last4 ||
    record.expiryMonth !== expectedCard.expiryMonth ||
    record.expiryYear !== expectedCard.expiryYear ||
    record.currency !== expectedCard.currency ||
    alias !== expectation.alias ||
    (expectation.availableBalanceMinor !== null &&
      availableBalanceMinor !== expectation.availableBalanceMinor) ||
    (expectation.createdAt !== null && createdAt !== expectation.createdAt) ||
    capabilities.freeze !== (action === "unfreeze") ||
    capabilities.unfreeze !== (action === "freeze") ||
    capabilities.replace !== expectedCard.capabilities.replace ||
    capabilities.renew !== expectedCard.capabilities.renew ||
    capabilities.updateLimits !== expectedCard.capabilities.updateLimits
  ) {
    throw new Error("Backend returned an unexpected Card status update");
  }
  return {
    cardId: expectation.cardId,
    type,
    status,
    last4: expectedCard.last4,
    expiry: expectedCard.expiry,
    expiryMonth: expectedCard.expiryMonth,
    expiryYear: expectedCard.expiryYear,
    currency: expectedCard.currency,
    alias,
    balance: Number(availableBalanceMinor) / 100,
    availableBalanceMinor,
    createdAt,
    capabilities,
  };
}

type CardActivationExpectation = Readonly<{
  cardId: string;
  type: "virtual" | "physical";
  last4: string;
  expiryMonth: number | undefined;
  expiryYear: number | undefined;
  currency: string;
  alias: string | undefined;
  availableBalanceMinor: string | undefined;
  createdAt: string | undefined;
}>;

function cardActivationExpectation(card: WalletCard): CardActivationExpectation {
  if (
    !/^[A-Za-z0-9_-]{2,128}$/.test(card.cardId) ||
    (card.type !== "virtual" && card.type !== "physical") ||
    card.status !== "pending" ||
    (card.last4 !== "" && !/^\d{4}$/.test(card.last4)) ||
    !/^[A-Z]{3}$/.test(card.currency) ||
    (card.expiryMonth === undefined) !== (card.expiryYear === undefined)
  ) {
    throw new Error("Selected Card cannot be activated");
  }
  if (
    card.expiryMonth !== undefined &&
    (!Number.isInteger(card.expiryMonth) ||
      card.expiryMonth < 1 ||
      card.expiryMonth > 12 ||
      !Number.isInteger(card.expiryYear) ||
      card.expiryYear === undefined ||
      card.expiryYear < 2000 ||
      card.expiryYear > 9999 ||
      card.expiry !==
        `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`)
  ) {
    throw new Error("Selected Card cannot be activated");
  }
  const alias = card.alias === undefined ? undefined : virtualCardAlias(card.alias, true);
  const availableBalanceMinor =
    card.availableBalanceMinor === undefined
      ? undefined
      : cardMinorUnits(card.availableBalanceMinor, "available balance");
  const createdAt = card.createdAt === undefined ? undefined : cardRfc3339(card.createdAt);
  const capabilities = strictCardCapabilities(card.capabilities);
  if (
    capabilities.freeze ||
    capabilities.unfreeze ||
    capabilities.replace ||
    capabilities.renew ||
    !capabilities.updateLimits
  ) {
    throw new Error("Selected Card cannot be activated");
  }
  return Object.freeze({
    cardId: card.cardId,
    type: card.type,
    last4: card.last4,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    currency: card.currency,
    alias,
    availableBalanceMinor,
    createdAt,
  });
}

export function buildCardActivationRequest(
  card: WalletCard,
  idempotencyKey: string,
  signal?: AbortSignal,
): { path: string; init: RequestInit } {
  const expectation = cardActivationExpectation(card);
  return {
    path: `/v1/cards/${encodeURIComponent(expectation.cardId)}/activate`,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
      ...(signal ? { signal } : {}),
    },
  };
}

function exactCardActivationRecord(value: unknown): Record<string, unknown> {
  const required = [
    "id",
    "type",
    "status",
    "last4",
    "expiryMonth",
    "expiryYear",
    "currency",
    "alias",
    "createdAt",
    "capabilities",
  ] as const;
  try {
    return exactOwnJsonDataRecord(
      value,
      [...required, "availableBalanceMinor"],
      "Backend returned an invalid activated Card snapshot",
    );
  } catch {
    return exactOwnJsonDataRecord(
      value,
      required,
      "Backend returned an invalid activated Card snapshot",
    );
  }
}

function cardActivationExpiry(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error("Backend returned an invalid activated Card snapshot");
  }
  return value;
}

export function normalizeCardActivationSnapshot(
  value: unknown,
  expectedCard: WalletCard,
): WalletCard {
  const expectation = cardActivationExpectation(expectedCard);
  const record = exactCardActivationRecord(value);
  const type =
    record.type === "VIRTUAL" ? "virtual" : record.type === "PHYSICAL" ? "physical" : null;
  const last4 = record.last4 === null ? "" : record.last4;
  const expiryMonth = cardActivationExpiry(record.expiryMonth, 1, 12);
  const expiryYear = cardActivationExpiry(record.expiryYear, 2000, 9999);
  const alias = record.alias === null ? undefined : virtualCardAlias(record.alias, true);
  const availableBalanceMinor =
    record.availableBalanceMinor === undefined
      ? undefined
      : cardMinorUnits(record.availableBalanceMinor, "available balance");
  const createdAt = cardRfc3339(record.createdAt);
  const capabilities = strictCardCapabilities(record.capabilities);
  if (
    record.id !== expectation.cardId ||
    type !== expectation.type ||
    record.status !== "ACTIVE" ||
    last4 !== expectation.last4 ||
    expiryMonth !== expectation.expiryMonth ||
    expiryYear !== expectation.expiryYear ||
    record.currency !== expectation.currency ||
    alias !== expectation.alias ||
    (expectation.availableBalanceMinor !== undefined &&
      availableBalanceMinor !== expectation.availableBalanceMinor) ||
    (expectation.createdAt !== undefined && createdAt !== expectation.createdAt) ||
    capabilities.freeze !== true ||
    capabilities.unfreeze !== false ||
    capabilities.replace !== true ||
    capabilities.renew !== (expiryMonth !== undefined && expiryYear !== undefined) ||
    capabilities.updateLimits !== true
  ) {
    throw new Error("Backend did not confirm the selected Card as ACTIVE");
  }
  return {
    cardId: expectation.cardId,
    type,
    status: "active",
    last4,
    expiry:
      expiryMonth === undefined || expiryYear === undefined
        ? "—"
        : `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear).slice(-2)}`,
    expiryMonth,
    expiryYear,
    currency: expectation.currency,
    alias,
    balance:
      availableBalanceMinor === undefined
        ? expectedCard.balance
        : Number(availableBalanceMinor) / 100,
    ...(availableBalanceMinor === undefined ? {} : { availableBalanceMinor }),
    createdAt,
    capabilities,
  };
}

function renewableCardExpectation(card: WalletCard): {
  cardId: string;
  expiryMonth: number;
  expiryYear: number;
} {
  const cardId = cardPublicId(card.cardId);
  if (
    (card.type !== "virtual" && card.type !== "physical") ||
    (card.status !== "active" && card.status !== "frozen") ||
    card.capabilities.renew !== true ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency) ||
    !Number.isInteger(card.expiryMonth) ||
    card.expiryMonth === undefined ||
    card.expiryMonth < 1 ||
    card.expiryMonth > 12 ||
    !Number.isInteger(card.expiryYear) ||
    card.expiryYear === undefined ||
    card.expiryYear < 2000 ||
    card.expiryYear > 9999 ||
    card.expiry !==
      `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`
  ) {
    throw new Error("Selected Card is not renewable");
  }
  return { cardId, expiryMonth: card.expiryMonth, expiryYear: card.expiryYear };
}

export function buildCardRenewRequest(
  card: WalletCard,
  idempotencyKey: string,
): { path: string; init: RequestInit } {
  const { cardId } = renewableCardExpectation(card);
  return {
    path: `/v1/cards/${encodeURIComponent(cardId)}/renew`,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
    },
  };
}

export function normalizeCardRenewResponse(value: unknown, expectedCard: WalletCard): WalletCard {
  const expectation = renewableCardExpectation(expectedCard);
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "last4",
      "expiryMonth",
      "expiryYear",
      "currency",
      "alias",
      "createdAt",
      "capabilities",
    ],
    "Backend returned an invalid renewed Card",
  );
  const type =
    record.type === "VIRTUAL" ? "virtual" : record.type === "PHYSICAL" ? "physical" : null;
  const status =
    record.status === "ACTIVE" ? "active" : record.status === "FROZEN" ? "frozen" : null;
  const alias = record.alias === null ? undefined : virtualCardAlias(record.alias, true);
  const createdAt = cardRfc3339(record.createdAt);
  const capabilities = strictCardCapabilities(record.capabilities);
  if (
    cardPublicId(record.id) !== expectation.cardId ||
    type !== expectedCard.type ||
    status !== expectedCard.status ||
    record.last4 !== expectedCard.last4 ||
    cardCurrency(record.currency) !== expectedCard.currency ||
    alias !== expectedCard.alias ||
    (expectedCard.createdAt !== undefined && createdAt !== expectedCard.createdAt) ||
    capabilities.freeze !== expectedCard.capabilities.freeze ||
    capabilities.unfreeze !== expectedCard.capabilities.unfreeze ||
    capabilities.replace !== expectedCard.capabilities.replace ||
    capabilities.renew !== expectedCard.capabilities.renew ||
    capabilities.updateLimits !== expectedCard.capabilities.updateLimits
  ) {
    throw new Error("Backend returned a different renewed Card");
  }
  if (
    typeof record.expiryMonth !== "number" ||
    !Number.isInteger(record.expiryMonth) ||
    record.expiryMonth < 1 ||
    record.expiryMonth > 12 ||
    typeof record.expiryYear !== "number" ||
    !Number.isInteger(record.expiryYear) ||
    record.expiryYear < 2000 ||
    record.expiryYear > 9999 ||
    record.expiryYear < expectation.expiryYear ||
    (record.expiryYear === expectation.expiryYear && record.expiryMonth <= expectation.expiryMonth)
  ) {
    throw new Error("Backend returned an invalid renewed Card expiry");
  }
  return {
    cardId: expectation.cardId,
    type,
    status,
    last4: expectedCard.last4,
    expiry: `${String(record.expiryMonth).padStart(2, "0")}/${String(record.expiryYear).slice(-2)}`,
    expiryMonth: record.expiryMonth,
    expiryYear: record.expiryYear,
    currency: expectedCard.currency,
    alias,
    balance: expectedCard.balance,
    availableBalanceMinor: expectedCard.availableBalanceMinor,
    createdAt,
    capabilities,
  };
}

function replaceableCardExpectation(card: WalletCard): {
  cardId: string;
  type: "virtual" | "physical";
  status: "active" | "frozen";
  expiryMonth: number;
  expiryYear: number;
} {
  const cardId = cardPublicId(card.cardId);
  if (
    (card.type !== "virtual" && card.type !== "physical") ||
    (card.status !== "active" && card.status !== "frozen") ||
    card.capabilities.replace !== true ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency) ||
    !Number.isInteger(card.expiryMonth) ||
    card.expiryMonth === undefined ||
    card.expiryMonth < 1 ||
    card.expiryMonth > 12 ||
    !Number.isInteger(card.expiryYear) ||
    card.expiryYear === undefined ||
    card.expiryYear < 2000 ||
    card.expiryYear > 9999 ||
    card.expiry !==
      `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`
  ) {
    throw new Error("Selected Card is not replaceable");
  }
  if (card.availableBalanceMinor !== undefined) {
    cardMinorUnits(card.availableBalanceMinor, "available balance");
  }
  return {
    cardId,
    type: card.type,
    status: card.status,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
  };
}

export function validateCardReplacementReason(value: unknown): CardReplacementReason {
  if (!isCardReplacementReason(value)) throw new Error("Invalid Card replacement reason");
  return value;
}

export function buildCardReplaceRequest(
  card: WalletCard,
  reason: CardReplacementReason,
  idempotencyKey: string,
): { path: string; init: RequestInit } {
  const { cardId } = replaceableCardExpectation(card);
  return {
    path: `/v1/cards/${encodeURIComponent(cardId)}/replace`,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
      body: JSON.stringify({ reason: validateCardReplacementReason(reason) }),
    },
  };
}

export function normalizeCardReplaceResponse(value: unknown, oldCard: WalletCard): WalletCard {
  const expectation = replaceableCardExpectation(oldCard);
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "last4",
      "expiryMonth",
      "expiryYear",
      "currency",
      "alias",
      "createdAt",
      "capabilities",
    ],
    "Backend returned an invalid replacement Card",
  );
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const minorDescriptor = descriptors.availableBalanceMinor;
  if (minorDescriptor && !("value" in minorDescriptor)) {
    throw new Error("Backend returned an invalid replacement Card balance");
  }
  const cardId = cardPublicId(record.id);
  if (cardId === expectation.cardId) {
    throw new Error("Backend did not return a new replacement Card");
  }
  const type =
    record.type === "VIRTUAL" ? "virtual" : record.type === "PHYSICAL" ? "physical" : null;
  const status =
    record.status === "PENDING"
      ? "pending"
      : record.status === "ACTIVE"
        ? "active"
        : record.status === "FROZEN"
          ? "frozen"
          : record.status === "CLOSED"
            ? "closed"
            : record.status === "FAILED"
              ? "failed"
              : null;
  const alias = record.alias === null ? undefined : virtualCardAlias(record.alias, true);
  if (
    type !== expectation.type ||
    status === null ||
    typeof record.last4 !== "string" ||
    !/^\d{4}$/.test(record.last4) ||
    cardCurrency(record.currency) !== oldCard.currency ||
    alias !== oldCard.alias
  ) {
    throw new Error("Backend returned an invalid replacement Card identity");
  }
  if (
    typeof record.expiryMonth !== "number" ||
    !Number.isInteger(record.expiryMonth) ||
    record.expiryMonth < 1 ||
    record.expiryMonth > 12 ||
    typeof record.expiryYear !== "number" ||
    !Number.isInteger(record.expiryYear) ||
    record.expiryYear < 2000 ||
    record.expiryYear > 9999
  ) {
    throw new Error("Backend returned an invalid replacement Card expiry");
  }
  const availableBalanceMinor =
    minorDescriptor !== undefined
      ? cardMinorUnits(minorDescriptor.value, "available balance")
      : oldCard.availableBalanceMinor === undefined
        ? undefined
        : cardMinorUnits(oldCard.availableBalanceMinor, "available balance");
  return {
    cardId,
    type,
    status,
    last4: record.last4,
    expiry: `${String(record.expiryMonth).padStart(2, "0")}/${String(record.expiryYear).slice(-2)}`,
    expiryMonth: record.expiryMonth,
    expiryYear: record.expiryYear,
    currency: oldCard.currency,
    alias,
    balance: availableBalanceMinor === undefined ? 0 : Number(availableBalanceMinor) / 100,
    availableBalanceMinor,
    createdAt: cardRfc3339(record.createdAt),
    capabilities: strictCardCapabilities(record.capabilities),
  };
}

export function buildCardBalancePath(cardId: string): string {
  cardPublicId(cardId);
  return `/v1/cards/${encodeURIComponent(cardId)}/balance`;
}

export function normalizeCardBalanceResponse(
  value: unknown,
  expectedCardId: string,
): WalletCardBalance {
  const selectedCardId = cardPublicId(expectedCardId);
  const record = ownJsonDataRecord(
    value,
    [
      "cardId",
      "currency",
      "availableBalanceMinor",
      "currentBalanceMinor",
      "pendingAmountMinor",
      "updatedAt",
    ],
    "Backend returned invalid Card balance",
  );
  const cardId = cardPublicId(record.cardId);
  if (cardId !== selectedCardId) {
    throw new Error("Backend returned a balance for a different Card");
  }
  return {
    cardId,
    currency: cardCurrency(record.currency),
    availableBalanceMinor: cardMinorUnits(record.availableBalanceMinor, "available balance"),
    currentBalanceMinor: cardMinorUnits(record.currentBalanceMinor, "current balance"),
    pendingAmountMinor: cardMinorUnits(record.pendingAmountMinor, "pending amount"),
    updatedAt: cardRfc3339(record.updatedAt),
  };
}

export function buildCardLimitsPath(cardId: string): string {
  cardPublicId(cardId);
  return `/v1/cards/${encodeURIComponent(cardId)}/limits`;
}

export function normalizeCardLimitsResponse(
  value: unknown,
  expectedCardId: string,
): WalletCardLimits {
  const selectedCardId = cardPublicId(expectedCardId);
  const record = ownJsonDataRecord(
    value,
    [
      "cardId",
      "singleTransactionMinor",
      "dailySpendMinor",
      "monthlySpendMinor",
      "dailyAtmMinor",
      "updatedAt",
    ],
    "Backend returned invalid Card limits",
  );
  const cardId = cardPublicId(record.cardId);
  if (cardId !== selectedCardId) {
    throw new Error("Backend returned limits for a different Card");
  }
  return {
    cardId,
    singleTransactionMinor: cardNullableLimit(
      record.singleTransactionMinor,
      "single transaction limit",
    ),
    dailySpendMinor: cardNullableLimit(record.dailySpendMinor, "daily spend limit"),
    monthlySpendMinor: cardNullableLimit(record.monthlySpendMinor, "monthly spend limit"),
    dailyAtmMinor: cardNullableLimit(record.dailyAtmMinor, "daily ATM limit"),
    updatedAt: record.updatedAt === null ? null : cardRfc3339(record.updatedAt),
  };
}

function selectedCardLimitsMutationExpectation(
  card: WalletCard,
  current: WalletCardLimits,
): string {
  const cardId = cardPublicId(card.cardId);
  if (
    current.cardId !== cardId ||
    (card.type !== "virtual" && card.type !== "physical") ||
    (card.status !== "active" && card.status !== "frozen" && card.status !== "pending") ||
    card.capabilities.updateLimits !== true ||
    !/^\d{4}$/.test(card.last4) ||
    !/^[A-Z]{3}$/.test(card.currency)
  ) {
    throw new Error("Selected Card limits cannot be updated");
  }
  for (const field of CARD_LIMIT_FIELDS) cardNullableLimit(current[field], field);
  if (current.updatedAt !== null) cardRfc3339(current.updatedAt);
  return cardId;
}

export function normalizeCardLimitsUpdateInput(
  value: unknown,
  current: WalletCardLimits,
): CardLimitsUpdateInput {
  for (const field of CARD_LIMIT_FIELDS) cardNullableLimit(current[field], field);
  if (current.updatedAt !== null) cardRfc3339(current.updatedAt);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("Invalid Card limits update");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowed = new Set<string>(CARD_LIMIT_FIELDS);
  if (Object.keys(descriptors).some((field) => !allowed.has(field))) {
    throw new Error("Invalid Card limits update field");
  }
  const normalized: CardLimitsUpdateInput = {};
  for (const field of CARD_LIMIT_FIELDS) {
    const descriptor = descriptors[field];
    if (!descriptor) continue;
    if (
      !("value" in descriptor) ||
      typeof descriptor.value !== "number" ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0 ||
      descriptor.value > CARD_LIMIT_UPDATE_MAX_MINOR
    ) {
      throw new Error(`Invalid Card ${field}`);
    }
    normalized[field] = descriptor.value;
  }
  if (Object.keys(normalized).length === 0) {
    throw new Error("At least one Card limit is required");
  }

  const merged = Object.fromEntries(
    CARD_LIMIT_FIELDS.map((field) => [
      field,
      normalized[field] === undefined ? current[field] : String(normalized[field]),
    ]),
  ) as Record<CardLimitField, string | null>;
  const single = merged.singleTransactionMinor;
  const daily = merged.dailySpendMinor;
  const monthly = merged.monthlySpendMinor;
  if (single !== null && daily !== null && BigInt(single) > BigInt(daily)) {
    throw new Error("Single transaction limit cannot exceed daily spend limit");
  }
  if (daily !== null && monthly !== null && BigInt(daily) > BigInt(monthly)) {
    throw new Error("Daily spend limit cannot exceed monthly spend limit");
  }
  return normalized;
}

export function buildCardLimitsUpdateRequest(
  card: WalletCard,
  current: WalletCardLimits,
  input: CardLimitsUpdateInput,
  idempotencyKey: string,
): { path: string; init: RequestInit } {
  const cardId = selectedCardLimitsMutationExpectation(card, current);
  const normalized = normalizeCardLimitsUpdateInput(input, current);
  return {
    path: `/v1/cards/${encodeURIComponent(cardId)}/limits`,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": validateVirtualCardIdempotencyKey(idempotencyKey) },
      body: JSON.stringify(normalized),
    },
  };
}

export function normalizeCardLimitsUpdateResponse(
  value: unknown,
  card: WalletCard,
  current: WalletCardLimits,
  input: CardLimitsUpdateInput,
): WalletCardLimits {
  const cardId = selectedCardLimitsMutationExpectation(card, current);
  const normalizedInput = normalizeCardLimitsUpdateInput(input, current);
  const result = normalizeCardLimitsResponse(value, cardId);
  for (const field of CARD_LIMIT_FIELDS) {
    const expected =
      normalizedInput[field] === undefined ? current[field] : String(normalizedInput[field]);
    if (result[field] !== expected) {
      throw new Error("Backend returned unexpected Card limits");
    }
  }
  if (result.updatedAt === null) {
    throw new Error("Backend returned an invalid Card limits update timestamp");
  }
  return result;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`Backend returned an invalid transaction ${field}`);
  }
  return value;
}

function optionalString(value: unknown, field: string, maxLength: number): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`Backend returned an invalid transaction ${field}`);
  }
  return value;
}

function cardTransactionTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 64) {
    throw new Error("Backend returned an invalid transaction timestamp");
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) throw new Error("Backend returned an invalid transaction timestamp");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[7] ?? 0);
  const offsetMinute = Number(match[8] ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Backend returned an invalid transaction timestamp");
  }
  return value;
}

function cardTransactionMcc(value: unknown): string {
  if (value === null) return "";
  if (typeof value !== "string" || !/^[0-9]{4}$/.test(value)) {
    throw new Error("Backend returned an invalid transaction category");
  }
  return value;
}

function cardTransactionMinorUnits(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|-?[1-9]\d{0,18})$/.test(value)) {
    throw new Error("Backend returned an invalid transaction amount");
  }
  const amount = BigInt(value);
  if (amount < -9_223_372_036_854_775_808n || amount > 9_223_372_036_854_775_807n) {
    throw new Error("Backend returned an invalid transaction amount");
  }
  return value;
}

function normalizeTransaction(value: unknown): WalletCardTransaction {
  const record = exactTrustedJsonRecord(
    value,
    [
      "id",
      "status",
      "amountMinor",
      "authorizedAmountMinor",
      "clearedAmountMinor",
      "settledAmountMinor",
      "reversedAmountMinor",
      "refundedAmountMinor",
      "currency",
      "traceId",
      "merchantName",
      "merchantCategory",
      "occurredAt",
    ],
    "Backend returned an invalid transaction",
  );
  const rawStatus = requiredString(record.status, "status", 32);
  if (
    !["AUTHORIZED", "DECLINED", "CLEARED", "SETTLED", "REVERSED", "REFUNDED"].includes(rawStatus)
  ) {
    throw new Error("Backend returned an invalid transaction status");
  }
  const amountMinor = cardTransactionMinorUnits(record.amountMinor);
  cardTransactionMinorUnits(record.authorizedAmountMinor);
  cardTransactionMinorUnits(record.clearedAmountMinor);
  cardTransactionMinorUnits(record.settledAmountMinor);
  cardTransactionMinorUnits(record.reversedAmountMinor);
  cardTransactionMinorUnits(record.refundedAmountMinor);
  if (
    record.traceId !== null &&
    (typeof record.traceId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(record.traceId))
  ) {
    throw new Error("Backend returned an invalid transaction trace");
  }
  const currency = requiredString(record.currency, "currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Backend returned an invalid transaction currency");
  }
  const id = requiredString(record.id, "id", 128);
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(id)) {
    throw new Error("Backend returned an invalid transaction id");
  }
  const timestamp = cardTransactionTimestamp(record.occurredAt);
  return {
    id,
    status: rawStatus.toLowerCase() as WalletCardTransaction["status"],
    amountMinor,
    currency,
    merchant:
      record.merchantName === null
        ? "Card transaction"
        : optionalString(record.merchantName, "merchant", 160) || "Card transaction",
    category: cardTransactionMcc(record.merchantCategory),
    timestamp,
  };
}

export function buildCardTransactionPath(
  cardId: string,
  query: WalletCardTransactionQuery = {},
): string {
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(cardId)) {
    throw new Error("Invalid card transaction card id");
  }
  const limit = query.limit ?? CARD_TRANSACTION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TRANSACTION_PAGE_SIZE) {
    throw new Error(`Card transaction limit must be between 1 and ${CARD_TRANSACTION_PAGE_SIZE}`);
  }
  if (query.cursor !== undefined && !isCanonicalCardTransactionCursor(query.cursor)) {
    throw new Error("Invalid card transaction cursor");
  }
  if (
    query.status !== undefined &&
    !(CARD_TRANSACTION_STATUSES as readonly string[]).includes(query.status)
  ) {
    throw new Error("Invalid card transaction status filter");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/cards/${encodeURIComponent(cardId)}/transactions?${params.toString()}`;
}

export function buildCardTransactionDetailPath(cardId: string, transactionId: string): string {
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(cardId)) {
    throw new Error("Invalid card transaction card id");
  }
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(transactionId)) {
    throw new Error("Invalid card transaction id");
  }
  return `/v1/cards/${encodeURIComponent(cardId)}/transactions/${encodeURIComponent(transactionId)}`;
}

export function normalizeCardTransactionDetailResponse(
  rawJson: string,
  expectation: WalletCardTransactionDetailExpectation,
): WalletCardTransaction {
  buildCardTransactionDetailPath(expectation.cardId, expectation.transactionId);
  const expectedCurrency = requiredString(expectation.currency, "currency", 3);
  if (!/^[A-Z]{3}$/.test(expectedCurrency)) {
    throw new Error("Invalid card transaction currency");
  }
  const expectedOccurredAt = cardTransactionTimestamp(expectation.occurredAt);
  if (typeof rawJson !== "string" || rawJson.length > CARD_TRANSACTION_MAX_JSON_BYTES) {
    throw new Error("Backend returned an invalid transaction detail");
  }
  if (new TextEncoder().encode(rawJson).byteLength > CARD_TRANSACTION_MAX_JSON_BYTES) {
    throw new Error("Backend returned an oversized transaction detail");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid transaction detail");
  }
  const detail = normalizeTransaction(parsed);
  if (detail.id !== expectation.transactionId) {
    throw new Error("Backend returned a different Card transaction id");
  }
  if (detail.currency !== expectedCurrency || detail.timestamp !== expectedOccurredAt) {
    throw new Error("Backend returned a Card transaction outside the selected list record");
  }
  return detail;
}

export function normalizeCardTransactionResponse(
  rawJson: string,
  limit = CARD_TRANSACTION_PAGE_SIZE,
  expectedStatus?: CardTransactionStatusFilter,
): WalletCardTransactionPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TRANSACTION_PAGE_SIZE) {
    throw new Error(`Card transaction limit must be between 1 and ${CARD_TRANSACTION_PAGE_SIZE}`);
  }
  if (typeof rawJson !== "string" || rawJson.length > CARD_TRANSACTION_MAX_JSON_BYTES) {
    throw new Error("Backend returned an invalid transaction page");
  }
  if (new TextEncoder().encode(rawJson).byteLength > CARD_TRANSACTION_MAX_JSON_BYTES) {
    throw new Error("Backend returned an oversized transaction page");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid transaction page");
  }
  const page = exactTrustedJsonRecord(
    parsed,
    ["transactions", "nextCursor"],
    "Backend returned an invalid transaction page",
  );
  const transactions = denseTrustedJsonArray(
    page.transactions,
    limit,
    "Backend returned an invalid transaction page",
  );
  if (page.nextCursor !== null && !isCanonicalCardTransactionCursor(page.nextCursor)) {
    throw new Error("Backend returned an invalid transaction cursor");
  }
  const normalized = transactions.map(normalizeTransaction);
  if (
    expectedStatus !== undefined &&
    normalized.some((transaction) => transaction.status !== expectedStatus.toLowerCase())
  ) {
    throw new Error("Backend returned a transaction outside the active status filter");
  }
  return {
    transactions: normalized,
    nextCursor: page.nextCursor,
  };
}

function cardTimelineIdentifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{2,128}$/.test(value)) {
    throw new Error("Backend returned an invalid Card timeline event id");
  }
  return value;
}

function cardTimelineType(value: unknown): CardTimelineType {
  if (typeof value !== "string" || !(CARD_TIMELINE_TYPES as readonly string[]).includes(value)) {
    throw new Error("Backend returned an invalid Card timeline type");
  }
  return value as CardTimelineType;
}

function cardTimelineStatus(value: unknown, field: string): CardTimelineStatus | null {
  if (value === null) return null;
  if (typeof value !== "string" || !(CARD_TIMELINE_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Backend returned an invalid Card timeline ${field}`);
  }
  return value as CardTimelineStatus;
}

function cardTimelineTimestamp(value: unknown): string {
  const timestamp = cardTransactionTimestamp(value);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw new Error("Backend returned an invalid Card timeline timestamp");
  }
  return timestamp;
}

function normalizeCardTimelineEvent(value: unknown): WalletCardTimelineEvent {
  const event = exactTrustedJsonRecord(
    value,
    ["id", "type", "fromStatus", "toStatus", "occurredAt"],
    "Backend returned an invalid Card timeline event",
  );
  return Object.freeze({
    id: cardTimelineIdentifier(event.id),
    type: cardTimelineType(event.type),
    fromStatus: cardTimelineStatus(event.fromStatus, "fromStatus"),
    toStatus: cardTimelineStatus(event.toStatus, "toStatus"),
    occurredAt: cardTimelineTimestamp(event.occurredAt),
  });
}

export function buildCardTimelinePath(cardId: string, query: WalletCardTimelineQuery = {}): string {
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(cardId)) {
    throw new Error("Invalid Card timeline Card id");
  }
  const limit = query.limit ?? CARD_TIMELINE_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TIMELINE_PAGE_SIZE) {
    throw new Error(`Card timeline limit must be between 1 and ${CARD_TIMELINE_PAGE_SIZE}`);
  }
  if (query.cursor !== undefined && !isCanonicalCardTimelineCursor(query.cursor)) {
    throw new Error("Invalid Card timeline cursor");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/cards/${encodeURIComponent(cardId)}/timeline?${params.toString()}`;
}

export function normalizeCardTimelineResponse(
  rawJson: string,
  limit = CARD_TIMELINE_PAGE_SIZE,
): WalletCardTimelinePage {
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TIMELINE_PAGE_SIZE) {
    throw new Error(`Card timeline limit must be between 1 and ${CARD_TIMELINE_PAGE_SIZE}`);
  }
  if (
    typeof rawJson !== "string" ||
    new TextEncoder().encode(rawJson).byteLength > CARD_TIMELINE_MAX_JSON_BYTES
  ) {
    throw new Error("Backend returned an invalid Card timeline page");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid Card timeline page");
  }
  const page = exactTrustedJsonRecord(
    parsed,
    ["events", "nextCursor"],
    "Backend returned an invalid Card timeline page",
  );
  const events = denseTrustedJsonArray(
    page.events,
    limit,
    "Backend returned an invalid Card timeline page",
  ).map(normalizeCardTimelineEvent);
  if (new Set(events.map((event) => event.id)).size !== events.length) {
    throw new Error("Backend returned duplicate Card timeline events");
  }
  for (let index = 1; index < events.length; index += 1) {
    if (Date.parse(events[index - 1].occurredAt) < Date.parse(events[index].occurredAt)) {
      throw new Error("Backend returned an out-of-order Card timeline page");
    }
  }
  const nextCursor = page.nextCursor;
  if (nextCursor !== null && !isCanonicalCardTimelineCursor(nextCursor)) {
    throw new Error("Backend returned an invalid Card timeline cursor");
  }
  if (events.length === 0 && nextCursor !== null) {
    throw new Error("Backend returned an empty continuing Card timeline page");
  }
  if (nextCursor !== null) {
    const cursorPosition = cardTimelineCursorPosition(nextCursor);
    const lastEvent = events.at(-1);
    if (
      !cursorPosition ||
      !lastEvent ||
      cursorPosition.id !== lastEvent.id ||
      cursorPosition.occurredAt !== lastEvent.occurredAt
    ) {
      throw new Error("Backend returned a mismatched Card timeline cursor");
    }
  }
  return Object.freeze({
    events: Object.freeze(events),
    nextCursor,
  });
}

function walletAssetCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z0-9]{2,12}$/.test(value)) {
    throw new Error("Backend returned an invalid Wallet asset code");
  }
  return value;
}

function walletBalanceTimestamp(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Backend returned an invalid Wallet balance timestamp");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/.exec(value);
  if (!match) throw new Error("Backend returned an invalid Wallet balance timestamp");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new Error("Backend returned an invalid Wallet balance timestamp");
  }
  return value;
}

function walletBalanceDecimal(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length > 38 ||
    !/^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/.test(value) ||
    value === "-0" ||
    (value.includes(".") && value.endsWith("0"))
  ) {
    throw new Error(`Backend returned an invalid Wallet ${field}`);
  }
  return value;
}

function walletBalanceMantissa(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  const mantissa = BigInt(`${integer}${fraction.padEnd(18, "0")}`);
  return negative ? -mantissa : mantissa;
}

function exactTrustedJsonRecord(
  value: unknown,
  fields: readonly string[],
  errorMessage: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(errorMessage);
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(errorMessage);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (
    ownKeys.length !== fields.length ||
    ownKeys.some((key) => typeof key !== "string" || !fields.includes(key))
  ) {
    throw new Error(errorMessage);
  }
  const record: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!descriptor || !("value" in descriptor)) throw new Error(errorMessage);
    record[field] = descriptor.value;
  }
  return record;
}

function denseTrustedJsonArray(value: unknown, maximum: number, errorMessage: string): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(errorMessage);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== value.length + 1) throw new Error(errorMessage);
  const items: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) throw new Error(errorMessage);
    items.push(descriptor.value);
  }
  return items;
}

function walletTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 64 || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Backend returned an invalid Wallet ${field}`);
  }
  return value;
}

function walletDecimal(value: unknown, field: string, absolute = false): string {
  const pattern = absolute
    ? /^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/
    : /^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/;
  if (
    typeof value !== "string" ||
    value.length > 37 ||
    !pattern.test(value) ||
    /^-0(?:\.0+)?$/.test(value)
  ) {
    throw new Error(`Backend returned an invalid Wallet ${field}`);
  }
  return value;
}

export function normalizeWalletBalanceResponse(rawJson: string): WalletAssetAccount[] {
  if (typeof rawJson !== "string" || rawJson.length > WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES) {
    throw new Error("Backend returned an invalid Wallet balance response");
  }
  if (new TextEncoder().encode(rawJson).byteLength > WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES) {
    throw new Error("Backend returned an oversized Wallet balance response");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid Wallet balance response");
  }
  const response = exactTrustedJsonRecord(
    parsed,
    ["items"],
    "Backend returned an invalid Wallet balance response",
  );
  const items = denseTrustedJsonArray(
    response.items,
    WALLET_BALANCE_SUMMARY_MAX_ITEMS,
    "Backend returned an invalid Wallet balance response",
  );
  const accounts = items.map((item) => {
    const record = exactTrustedJsonRecord(
      item,
      ["assetCode", "availableBalance", "ledgerBalance", "pendingBalance", "updatedAt"],
      "Backend returned an invalid Wallet balance account",
    ) as BackendWalletBalanceRecord;
    const availableBalance = walletBalanceDecimal(record.availableBalance, "available balance");
    const ledgerBalance = walletBalanceDecimal(record.ledgerBalance, "ledger balance");
    const pendingBalance = walletBalanceDecimal(record.pendingBalance, "pending balance");
    if (
      walletBalanceMantissa(availableBalance) + walletBalanceMantissa(pendingBalance) !==
      walletBalanceMantissa(ledgerBalance)
    ) {
      throw new Error("Backend returned an inconsistent Wallet balance account");
    }
    return Object.freeze({
      assetCode: walletAssetCode(record.assetCode),
      availableBalance,
      ledgerBalance,
      pendingBalance,
      updatedAt: walletBalanceTimestamp(record.updatedAt),
    });
  });
  for (let index = 1; index < accounts.length; index += 1) {
    if (accounts[index - 1].assetCode >= accounts[index].assetCode) {
      throw new Error("Backend returned an invalid Wallet balance account order");
    }
  }
  return accounts;
}

export function buildWalletTransactionPath(query: WalletAccountTransactionQuery): string {
  const assetCode = walletAssetCode(query.assetCode);
  if (
    query.type !== undefined &&
    !(WALLET_TRANSACTION_TYPES as readonly string[]).includes(query.type)
  ) {
    throw new Error("Invalid Wallet transaction type filter");
  }
  if (
    query.status !== undefined &&
    !(WALLET_TRANSACTION_STATUSES as readonly string[]).includes(query.status)
  ) {
    throw new Error("Invalid Wallet transaction status filter");
  }
  const limit = query.limit ?? WALLET_TRANSACTION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_TRANSACTION_PAGE_SIZE) {
    throw new Error(
      `Wallet transaction limit must be between 1 and ${WALLET_TRANSACTION_PAGE_SIZE}`,
    );
  }
  if (
    query.cursor !== undefined &&
    (!query.cursor || query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
  ) {
    throw new Error("Invalid Wallet transaction cursor");
  }
  const params = new URLSearchParams({ assetCode, limit: String(limit) });
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/wallet/transactions?${params.toString()}`;
}

function normalizeWalletTransaction(value: unknown): WalletAccountTransaction {
  const record = ownJsonDataRecord(
    value,
    ["id", "type", "status", "assetCode", "amount", "direction", "createdAt", "updatedAt"],
    "Backend returned an invalid Wallet transaction",
  ) as BackendWalletTransactionRecord;
  if (typeof record.id !== "string" || !/^[A-Za-z0-9._:-]{2,128}$/.test(record.id)) {
    throw new Error("Backend returned an invalid Wallet transaction id");
  }
  const types = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "MERCHANT_PAYMENT", "REFUND", "FX"];
  if (typeof record.type !== "string" || !types.includes(record.type)) {
    throw new Error("Backend returned an invalid Wallet transaction type");
  }
  const statuses = ["PENDING", "COMPLETED", "FAILED", "REVERSED"];
  if (typeof record.status !== "string" || !statuses.includes(record.status)) {
    throw new Error("Backend returned an invalid Wallet transaction status");
  }
  if (record.direction !== "INCOMING" && record.direction !== "OUTGOING") {
    throw new Error("Backend returned an invalid Wallet transaction direction");
  }
  return {
    id: record.id,
    type: record.type.toLowerCase() as WalletAccountTransaction["type"],
    status: record.status.toLowerCase() as WalletAccountTransaction["status"],
    assetCode: walletAssetCode(record.assetCode),
    amount: walletDecimal(record.amount, "transaction amount", true),
    direction: record.direction.toLowerCase() as WalletAccountTransaction["direction"],
    createdAt: walletTimestamp(record.createdAt, "transaction createdAt"),
    updatedAt: walletTimestamp(record.updatedAt, "transaction updatedAt"),
  };
}

export function buildWalletTransactionDetailPath(transactionId: string): string {
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(transactionId)) {
    throw new Error("Invalid Wallet transaction id");
  }
  return `/v1/wallet/transactions/${encodeURIComponent(transactionId)}`;
}

export function normalizeWalletTransactionDetail(
  value: unknown,
  expectation: WalletTransactionDetailExpectation,
): WalletAccountTransaction {
  buildWalletTransactionDetailPath(expectation.transactionId);
  const expectedAssetCode = walletAssetCode(expectation.assetCode);
  const expectedAmount = walletDecimal(expectation.amount, "transaction amount", true);
  const detail = normalizeWalletTransaction(value);
  if (detail.id !== expectation.transactionId) {
    throw new Error("Backend returned a different Wallet transaction id");
  }
  if (detail.assetCode !== expectedAssetCode) {
    throw new Error("Backend returned a Wallet transaction outside the selected account");
  }
  if (detail.amount !== expectedAmount) {
    throw new Error("Backend returned an inconsistent Wallet transaction amount");
  }
  return detail;
}

function walletRfc3339(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 64) {
    throw new Error(`Backend returned an invalid Wallet operation ${field}`);
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) {
    throw new Error(`Backend returned an invalid Wallet operation ${field}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[7] ?? 0);
  const offsetMinute = Number(match[8] ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`Backend returned an invalid Wallet operation ${field}`);
  }
  return value;
}

function walletTransferAccountId(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{2,128}$/.test(value)) {
    throw new Error(`Invalid Wallet transfer ${field}`);
  }
  return value;
}

function walletDecimalUnits(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const units = BigInt(`${whole}${fraction.padEnd(18, "0")}`);
  return negative ? -units : units;
}

function canonicalWalletTransferAmount(value: unknown): string {
  const amount = walletDecimal(value, "transfer amount", true);
  const [whole, fraction = ""] = amount.split(".");
  const canonicalFraction = fraction.replace(/0+$/, "");
  const canonical = canonicalFraction ? `${whole}.${canonicalFraction}` : whole;
  if (walletDecimalUnits(canonical) <= 0n) {
    throw new Error("Wallet transfer amount must be positive");
  }
  return canonical;
}

export function normalizeWalletTransferAccount(value: unknown): WalletTransferAccount {
  const record = exactTrustedJsonRecord(
    value,
    [
      "id",
      "accountCode",
      "name",
      "assetCode",
      "status",
      "currentBalance",
      "postedBalance",
      "pendingBalance",
      "availableBalance",
      "updatedAt",
    ],
    "Backend returned an invalid Wallet transfer account",
  );
  if (
    typeof record.accountCode !== "string" ||
    !record.accountCode.trim() ||
    record.accountCode.length > 128 ||
    typeof record.name !== "string" ||
    !record.name.trim() ||
    record.name.length > 160
  ) {
    throw new Error("Backend returned an invalid Wallet transfer account");
  }
  const id = walletTransferAccountId(record.id, "source account id");
  const assetCode = walletAssetCode(record.assetCode);
  if (record.status !== "ACTIVE" && record.status !== "FROZEN" && record.status !== "CLOSED") {
    throw new Error("Backend returned an invalid Wallet account status");
  }
  const currentBalance = walletDecimal(record.currentBalance, "current balance");
  const postedBalance = walletDecimal(record.postedBalance, "posted balance");
  const pendingBalance = walletDecimal(record.pendingBalance, "pending balance");
  const availableBalance = walletDecimal(record.availableBalance, "available balance");
  if (
    walletDecimalUnits(currentBalance) !==
      walletDecimalUnits(postedBalance) + walletDecimalUnits(pendingBalance) ||
    walletDecimalUnits(availableBalance) !== walletDecimalUnits(postedBalance)
  ) {
    throw new Error("Backend returned inconsistent Wallet account balances");
  }
  return {
    id,
    assetCode,
    status: record.status.toLowerCase() as WalletTransferAccount["status"],
    currentBalance,
    postedBalance,
    pendingBalance,
    availableBalance,
    updatedAt: walletRfc3339(record.updatedAt, "account updatedAt"),
  };
}

export function normalizeWalletTransferSourceAccount(value: unknown): WalletTransferAccount {
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "assetCode",
      "status",
      "currentBalance",
      "postedBalance",
      "pendingBalance",
      "availableBalance",
      "updatedAt",
    ],
    "Invalid Wallet transfer source account",
  );
  if (record.status !== "active" && record.status !== "frozen" && record.status !== "closed") {
    throw new Error("Invalid Wallet transfer source account status");
  }
  const currentBalance = walletDecimal(record.currentBalance, "current balance");
  const postedBalance = walletDecimal(record.postedBalance, "posted balance");
  const pendingBalance = walletDecimal(record.pendingBalance, "pending balance");
  const availableBalance = walletDecimal(record.availableBalance, "available balance");
  if (
    walletDecimalUnits(currentBalance) !==
      walletDecimalUnits(postedBalance) + walletDecimalUnits(pendingBalance) ||
    walletDecimalUnits(availableBalance) !== walletDecimalUnits(postedBalance)
  ) {
    throw new Error("Invalid Wallet transfer source account balances");
  }
  return {
    id: walletTransferAccountId(record.id, "source account id"),
    assetCode: walletAssetCode(record.assetCode),
    status: record.status,
    currentBalance,
    postedBalance,
    pendingBalance,
    availableBalance,
    updatedAt: walletRfc3339(record.updatedAt, "account updatedAt"),
  };
}

export function normalizeWalletTransferAccountsResponse(rawJson: string): WalletTransferAccount[] {
  if (typeof rawJson !== "string" || rawJson.length > WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES) {
    throw new Error("Backend returned an invalid Wallet transfer account list");
  }
  if (new TextEncoder().encode(rawJson).byteLength > WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES) {
    throw new Error("Backend returned an oversized Wallet transfer account list");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid Wallet transfer account list");
  }
  const accounts = denseTrustedJsonArray(
    parsed,
    WALLET_TRANSFER_ACCOUNT_MAX_ITEMS,
    "Backend returned an invalid Wallet transfer account list",
  ).map(normalizeWalletTransferAccount);
  if (new Set(accounts.map(({ id }) => id)).size !== accounts.length) {
    throw new Error("Backend returned duplicate Wallet account ids");
  }
  return accounts;
}

export function normalizeWalletTransferInput(
  value: unknown,
  source: WalletTransferAccount,
): WalletTransferInput {
  const normalizedSource = normalizeWalletTransferSourceAccount(source);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("Invalid Wallet transfer request");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.keys(descriptors).some((field) => field !== "destinationAccountId" && field !== "amount")
  ) {
    throw new Error("Invalid Wallet transfer request field");
  }
  const destination = descriptors.destinationAccountId;
  const amountDescriptor = descriptors.amount;
  if (
    !destination ||
    !("value" in destination) ||
    !amountDescriptor ||
    !("value" in amountDescriptor)
  ) {
    throw new Error("Invalid Wallet transfer request");
  }
  const destinationAccountId = walletTransferAccountId(destination.value, "destination account id");
  if (destinationAccountId === normalizedSource.id) {
    throw new Error("Source and destination Wallet accounts must differ");
  }
  if (normalizedSource.status !== "active") {
    throw new Error("Wallet transfer source account is not active");
  }
  const amount = canonicalWalletTransferAmount(amountDescriptor.value);
  if (walletDecimalUnits(amount) > walletDecimalUnits(normalizedSource.availableBalance)) {
    throw new Error("Wallet transfer amount exceeds the available balance");
  }
  return { destinationAccountId, amount };
}

export function buildWalletTransferRequest(
  source: WalletTransferAccount,
  input: WalletTransferInput,
  idempotencyKey: string,
): { path: "/v1/wallet/transfers"; init: RequestInit } {
  const normalizedSource = normalizeWalletTransferSourceAccount(source);
  const normalizedInput = normalizeWalletTransferInput(input, normalizedSource);
  const key = validateVirtualCardIdempotencyKey(idempotencyKey);
  return {
    path: "/v1/wallet/transfers",
    init: {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({
        sourceAccountId: normalizedSource.id,
        destinationAccountId: normalizedInput.destinationAccountId,
        assetCode: normalizedSource.assetCode,
        amount: normalizedInput.amount,
      }),
    },
  };
}

export function normalizeWalletTransferResponse(
  rawJson: string,
  source: WalletTransferAccount,
  input: WalletTransferInput,
): WalletOperationActivity {
  if (typeof rawJson !== "string" || rawJson.length > WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES) {
    throw new Error("Backend returned an invalid Wallet transfer operation");
  }
  if (new TextEncoder().encode(rawJson).byteLength > WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES) {
    throw new Error("Backend returned an oversized Wallet transfer operation");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Backend returned an invalid Wallet transfer operation");
  }
  const value = exactTrustedJsonRecord(
    parsed,
    [
      "id",
      "type",
      "status",
      "assetCode",
      "amount",
      "direction",
      "createdAt",
      "completedAt",
      "updatedAt",
    ],
    "Backend returned an invalid Wallet transfer operation",
  );
  const normalizedSource = normalizeWalletTransferSourceAccount(source);
  const normalizedInput = normalizeWalletTransferInput(input, normalizedSource);
  const operation = normalizeWalletOperation(value);
  const amount = canonicalWalletTransferAmount(operation.amount);
  if (
    operation.type !== "internal_transfer" ||
    operation.assetCode !== normalizedSource.assetCode ||
    amount !== normalizedInput.amount ||
    (operation.direction !== "outgoing" && operation.direction !== "between_own_accounts")
  ) {
    throw new Error("Backend returned an inconsistent Wallet transfer operation");
  }
  return { ...operation, amount };
}

export function buildWalletOperationPath(query: WalletOperationActivityQuery = {}): string {
  const limit = query.limit ?? WALLET_OPERATION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_OPERATION_PAGE_SIZE) {
    throw new Error(`Wallet operation limit must be between 1 and ${WALLET_OPERATION_PAGE_SIZE}`);
  }
  if (query.type !== undefined && !WALLET_OPERATION_TYPES.includes(query.type))
    throw new Error("Invalid Wallet operation type filter");
  if (query.status !== undefined && !WALLET_OPERATION_STATUSES.includes(query.status))
    throw new Error("Invalid Wallet operation status filter");
  if (query.cursor !== undefined) decodeWalletOperationCursor(query.cursor, query);
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/wallet/operations?${params.toString()}`;
}

type WalletOperationCursorV2 = {
  version: 2;
  createdAt: string;
  id: string;
  type: WalletOperationTypeFilter | null;
  status: WalletOperationStatusFilter | null;
};

function decodeWalletOperationCursor(
  value: unknown,
  expected: Pick<WalletOperationActivityQuery, "type" | "status">,
): WalletOperationCursorV2 {
  if (typeof value !== "string" || !value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Invalid Wallet operation cursor");
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const canonical = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    if (canonical !== value) throw new Error("non-canonical cursor");
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid cursor payload");
    const record = parsed as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "createdAt,id,status,type,version")
      throw new Error("invalid cursor keys");
    if (
      record.version !== 2 ||
      typeof record.createdAt !== "string" ||
      new Date(record.createdAt).toISOString() !== record.createdAt ||
      typeof record.id !== "string" ||
      !/^[A-Za-z0-9._:-]{2,128}$/.test(record.id)
    )
      throw new Error("invalid cursor payload");
    const type = record.type === null ? null : (record.type as WalletOperationTypeFilter);
    const status = record.status === null ? null : (record.status as WalletOperationStatusFilter);
    if (
      (type !== null && !WALLET_OPERATION_TYPES.includes(type)) ||
      (status !== null && !WALLET_OPERATION_STATUSES.includes(status)) ||
      type !== (expected.type ?? null) ||
      status !== (expected.status ?? null)
    )
      throw new Error("cursor filters do not match");
    return { version: 2, createdAt: record.createdAt, id: record.id, type, status };
  } catch {
    throw new Error("Invalid Wallet operation cursor");
  }
}

function walletOperationPrecedes(
  left: Pick<WalletOperationActivity, "createdAt" | "id">,
  right: Pick<WalletOperationActivity, "createdAt" | "id">,
): boolean {
  return (
    Date.parse(left.createdAt) > Date.parse(right.createdAt) ||
    (Date.parse(left.createdAt) === Date.parse(right.createdAt) && left.id > right.id)
  );
}

function normalizeWalletOperation(value: unknown): WalletOperationActivity {
  const record = ownJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "assetCode",
      "amount",
      "direction",
      "createdAt",
      "completedAt",
      "updatedAt",
    ],
    "Backend returned an invalid Wallet operation",
    (field) => `Backend returned an invalid Wallet operation ${field}`,
  );
  if (typeof record.id !== "string" || !/^[A-Za-z0-9._:-]{2,128}$/.test(record.id)) {
    throw new Error("Backend returned an invalid Wallet operation id");
  }
  const types = ["DEPOSIT", "INTERNAL_TRANSFER", "WITHDRAWAL", "FX_CONVERSION"];
  if (typeof record.type !== "string" || !types.includes(record.type)) {
    throw new Error("Backend returned an invalid Wallet operation type");
  }
  const statuses = ["PROCESSING", "PENDING_SETTLEMENT", "COMPLETED", "FAILED"];
  if (typeof record.status !== "string" || !statuses.includes(record.status)) {
    throw new Error("Backend returned an invalid Wallet operation status");
  }
  const directions = ["OUTGOING", "INCOMING", "BETWEEN_OWN_ACCOUNTS"];
  if (typeof record.direction !== "string" || !directions.includes(record.direction)) {
    throw new Error("Backend returned an invalid Wallet operation direction");
  }
  const completedAt =
    record.completedAt === null ? null : walletRfc3339(record.completedAt, "completedAt");
  return {
    id: record.id,
    type: record.type.toLowerCase() as WalletOperationActivity["type"],
    status: record.status.toLowerCase() as WalletOperationActivity["status"],
    assetCode: walletAssetCode(record.assetCode),
    amount: walletDecimal(record.amount, "operation amount", true),
    direction: record.direction.toLowerCase() as WalletOperationActivity["direction"],
    createdAt: walletRfc3339(record.createdAt, "createdAt"),
    completedAt,
    updatedAt: walletRfc3339(record.updatedAt, "updatedAt"),
  };
}

const WALLET_TRANSFER_STATUS_TRANSITIONS: Readonly<
  Record<WalletOperationActivity["status"], readonly WalletOperationActivity["status"][]>
> = {
  processing: ["processing", "pending_settlement", "completed", "failed"],
  pending_settlement: ["pending_settlement", "completed", "failed"],
  completed: ["completed"],
  failed: ["failed"],
};

export function normalizeWalletTransferStatusExpectation(
  expectation: WalletTransferStatusExpectation,
): WalletOperationActivity {
  const previous = expectation.previous;
  buildWalletOperationDetailPath(previous.id);
  if (
    previous.type !== "internal_transfer" ||
    (previous.direction !== "outgoing" && previous.direction !== "between_own_accounts") ||
    !WALLET_TRANSFER_STATUS_TRANSITIONS[previous.status]
  ) {
    throw new Error("Invalid Wallet transfer status expectation");
  }
  const amount = canonicalWalletTransferAmount(previous.amount);
  const createdAt = walletRfc3339(previous.createdAt, "createdAt");
  const updatedAt = walletRfc3339(previous.updatedAt, "updatedAt");
  const completedAt =
    previous.completedAt === null ? null : walletRfc3339(previous.completedAt, "completedAt");
  if (
    Date.parse(updatedAt) < Date.parse(createdAt) ||
    (completedAt !== null && Date.parse(completedAt) < Date.parse(createdAt)) ||
    (previous.status === "completed" && completedAt === null) ||
    ((previous.status === "processing" || previous.status === "pending_settlement") &&
      completedAt !== null)
  ) {
    throw new Error("Invalid Wallet transfer status expectation");
  }
  return {
    ...previous,
    assetCode: walletAssetCode(previous.assetCode),
    amount,
    createdAt,
    completedAt,
    updatedAt,
  };
}

export function normalizeWalletTransferStatusResponse(
  value: unknown,
  expectation: WalletTransferStatusExpectation,
): WalletOperationActivity {
  const previous = normalizeWalletTransferStatusExpectation(expectation);
  const exact = exactOwnJsonDataRecord(
    value,
    [
      "id",
      "type",
      "status",
      "assetCode",
      "amount",
      "direction",
      "createdAt",
      "completedAt",
      "updatedAt",
    ],
    "Backend returned an invalid Wallet transfer status",
  );
  const current = normalizeWalletOperation(exact);
  const amount = canonicalWalletTransferAmount(current.amount);
  if (
    current.id !== previous.id ||
    current.type !== previous.type ||
    current.assetCode !== previous.assetCode ||
    amount !== previous.amount ||
    current.direction !== previous.direction ||
    current.createdAt !== previous.createdAt ||
    !WALLET_TRANSFER_STATUS_TRANSITIONS[previous.status].includes(current.status) ||
    Date.parse(current.updatedAt) < Date.parse(previous.updatedAt) ||
    (previous.completedAt !== null && current.completedAt !== previous.completedAt) ||
    (current.completedAt !== null &&
      Date.parse(current.completedAt) < Date.parse(current.createdAt)) ||
    (current.status === "completed" && current.completedAt === null) ||
    ((current.status === "processing" || current.status === "pending_settlement") &&
      current.completedAt !== null)
  ) {
    throw new Error("Backend returned an inconsistent Wallet transfer status");
  }
  return { ...current, amount };
}

export function buildWalletOperationDetailPath(operationId: string): string {
  if (!/^[A-Za-z0-9._:-]{2,128}$/.test(operationId)) {
    throw new Error("Invalid Wallet operation id");
  }
  return `/v1/wallet/operations/${encodeURIComponent(operationId)}`;
}

export function normalizeWalletOperationDetail(
  value: unknown,
  expectation: WalletOperationDetailExpectation,
): WalletOperationActivity {
  buildWalletOperationDetailPath(expectation.operationId);
  const detail = normalizeWalletOperation(value);
  if (detail.id !== expectation.operationId) {
    throw new Error("Backend returned a different Wallet operation id");
  }
  return detail;
}

export function normalizeWalletOperationResponse(
  value: unknown,
  query: WalletOperationActivityQuery = {},
): WalletOperationActivityPage {
  const limit = query.limit ?? WALLET_OPERATION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_OPERATION_PAGE_SIZE) {
    throw new Error(`Wallet operation limit must be between 1 and ${WALLET_OPERATION_PAGE_SIZE}`);
  }
  const page = ownJsonDataRecord(
    value,
    ["items", "nextCursor"],
    "Backend returned an invalid Wallet operation page",
  );
  const rawItems = ownJsonArray(page.items, "Backend returned an invalid Wallet operation page");
  if (rawItems.length > limit) {
    throw new Error("Backend returned an invalid Wallet operation page");
  }
  const requestedCursor = query.cursor ? decodeWalletOperationCursor(query.cursor, query) : null;
  let nextCursor: string | null = null;
  if (page.nextCursor !== null) {
    if (typeof page.nextCursor !== "string")
      throw new Error("Backend returned an invalid Wallet operation cursor");
    try {
      decodeWalletOperationCursor(page.nextCursor, query);
      nextCursor = page.nextCursor;
    } catch {
      throw new Error("Backend returned an invalid Wallet operation cursor");
    }
  }
  const items = rawItems.map(normalizeWalletOperation);
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) {
    throw new Error("Backend returned duplicate Wallet operation ids");
  }
  if (query.type && items.some((item) => item.type !== query.type?.toLowerCase()))
    throw new Error("Backend returned a Wallet operation outside the selected type filter");
  if (query.status && items.some((item) => item.status !== query.status?.toLowerCase()))
    throw new Error("Backend returned a Wallet operation outside the selected status filter");
  for (let index = 1; index < items.length; index += 1)
    if (!walletOperationPrecedes(items[index - 1]!, items[index]!))
      throw new Error("Backend returned inconsistent Wallet operation pagination");
  if (requestedCursor && items[0] && !walletOperationPrecedes(requestedCursor, items[0]))
    throw new Error("Backend returned inconsistent Wallet operation pagination");
  if (nextCursor !== null) {
    if (items.length !== limit)
      throw new Error("Backend returned inconsistent Wallet operation pagination");
    const boundary = decodeWalletOperationCursor(nextCursor, query);
    const last = items.at(-1)!;
    if (boundary.createdAt !== new Date(last.createdAt).toISOString() || boundary.id !== last.id)
      throw new Error("Backend returned inconsistent Wallet operation pagination");
  }
  return { items, nextCursor };
}

export function normalizeWalletTransactionResponse(
  value: unknown,
  expectedAssetCode: string,
  limit = WALLET_TRANSACTION_PAGE_SIZE,
  expectedFilters: Pick<WalletAccountTransactionQuery, "type" | "status"> = {},
): WalletAccountTransactionPage {
  const assetCode = walletAssetCode(expectedAssetCode);
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_TRANSACTION_PAGE_SIZE) {
    throw new Error(
      `Wallet transaction limit must be between 1 and ${WALLET_TRANSACTION_PAGE_SIZE}`,
    );
  }
  let parsed = value;
  if (typeof value === "string") {
    if (
      value.length > WALLET_TRANSACTION_MAX_JSON_BYTES ||
      new TextEncoder().encode(value).byteLength > WALLET_TRANSACTION_MAX_JSON_BYTES
    ) {
      throw new Error("Backend returned an oversized Wallet transaction page");
    }
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error("Backend returned an invalid Wallet transaction page");
    }
  }
  const page = ownJsonDataRecord(
    parsed,
    ["items", "nextCursor"],
    "Backend returned an invalid Wallet transaction page",
  ) as BackendWalletTransactionPageRecord;
  const rawItems = ownJsonArray(page.items, "Backend returned an invalid Wallet transaction page");
  if (rawItems.length > limit) {
    throw new Error("Backend returned an invalid Wallet transaction page");
  }
  if (
    page.nextCursor !== null &&
    (typeof page.nextCursor !== "string" ||
      !page.nextCursor ||
      page.nextCursor.length > WALLET_TRANSACTION_MAX_CURSOR_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))
  ) {
    throw new Error("Backend returned an invalid Wallet transaction cursor");
  }
  const items = rawItems.map(normalizeWalletTransaction);
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("Backend returned duplicate Wallet transaction ids");
  }
  if (items.some((item) => item.assetCode !== assetCode)) {
    throw new Error("Backend returned a Wallet transaction outside the selected account");
  }
  if (
    expectedFilters.type &&
    items.some((item) => item.type !== expectedFilters.type?.toLowerCase())
  ) {
    throw new Error("Backend returned a Wallet transaction outside the selected type filter");
  }
  if (
    expectedFilters.status &&
    items.some((item) => item.status !== expectedFilters.status?.toLowerCase())
  ) {
    throw new Error("Backend returned a Wallet transaction outside the selected status filter");
  }
  return { items, nextCursor: page.nextCursor };
}

export const backendApi = {
  register(input: BackendCredentials) {
    return request<BackendSession>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: BackendCredentials) {
    return request<BackendSession>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refreshSession() {
    return request<BackendSession>("/v1/auth/refresh", { method: "POST" });
  },

  logout() {
    return request<void>("/v1/auth/logout", { method: "POST" });
  },

  session() {
    return request<BackendSession>("/v1/session");
  },

  async createFxQuotePreview(
    session: BackendSession,
    input: FxQuoteInput,
    signal?: AbortSignal,
  ): Promise<FxQuote> {
    const runtime = requireRuntime();
    if (
      !fxQuoteSameOriginApiAllowed(runtime.apiUrl, runtime.environment) ||
      !fxQuoteSessionAllowed(session, runtime.environment)
    ) {
      throw new BackendApiError(
        0,
        "runtime",
        "FX quote preview requires same-origin /api and a matching, unexpired SANDBOX or TEST session",
      );
    }
    const requestContract = buildFxQuoteRequest(input);
    const raw = await request<string>(
      requestContract.path,
      { ...requestContract.init, signal },
      "text",
    );
    return normalizeFxQuoteResponse(raw, session.environment, requestContract.input);
  },

  async listCards(query: WalletCardListQuery = {}, signal?: AbortSignal): Promise<WalletCardPage> {
    const limit = query.limit ?? CARD_LIST_PAGE_SIZE;
    const page = await request<unknown>(buildCardListPath(query), { signal });
    return normalizeCardListResponse(page, limit);
  },

  async cardBalance(cardId: string, signal?: AbortSignal): Promise<WalletCardBalance> {
    const result = await request<unknown>(buildCardBalancePath(cardId), { signal });
    return normalizeCardBalanceResponse(result, cardId);
  },

  async cardLimits(cardId: string, signal?: AbortSignal): Promise<WalletCardLimits> {
    const result = await request<unknown>(buildCardLimitsPath(cardId), { signal });
    return normalizeCardLimitsResponse(result, cardId);
  },

  async updateCardLimits(
    card: WalletCard,
    current: WalletCardLimits,
    input: CardLimitsUpdateInput,
    idempotencyKey: string,
  ): Promise<WalletCardLimits> {
    requireSandboxTestCardMutationRuntime();
    const { path, init } = buildCardLimitsUpdateRequest(card, current, input, idempotencyKey);
    return normalizeCardLimitsUpdateResponse(
      await request<unknown>(path, init),
      card,
      current,
      input,
    );
  },

  async activateCard(
    session: BackendSession,
    card: WalletCard,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<void> {
    requireCardActivationRuntime(session);
    const { path, init } = buildCardActivationRequest(card, idempotencyKey, signal);
    await request<string>(path, init, "text", CARD_ACTIVATION_MAX_RESPONSE_BYTES);
    requireCardActivationRuntime(session);
  },

  async activatedCardSnapshot(
    session: BackendSession,
    card: WalletCard,
    signal?: AbortSignal,
  ): Promise<WalletCard> {
    requireCardActivationRuntime(session);
    const expectation = cardActivationExpectation(card);
    const snapshot = await request<string>(
      `/v1/cards/${encodeURIComponent(expectation.cardId)}`,
      { signal },
      "text",
      CARD_ACTIVATION_MAX_RESPONSE_BYTES,
    );
    requireCardActivationRuntime(session);
    return normalizeCardActivationSnapshot(snapshot, card);
  },

  async getCard(cardId: string): Promise<WalletCard> {
    const card = await request<BackendCardRecord>(`/v1/cards/${encodeURIComponent(cardId)}`);
    return normalizeCard(card);
  },

  async createVirtualCard(
    input: VirtualCardCreateInput,
    idempotencyKey: string,
  ): Promise<WalletCard> {
    requireSandboxTestCardMutationRuntime();
    const { path, init } = buildVirtualCardCreateRequest(input, idempotencyKey);
    const card = await request<unknown>(path, init);
    return normalizeVirtualCardCreateResponse(card);
  },

  async renewCard(card: WalletCard, idempotencyKey: string): Promise<WalletCard> {
    requireSandboxTestCardMutationRuntime();
    const { path, init } = buildCardRenewRequest(card, idempotencyKey);
    return normalizeCardRenewResponse(await request<unknown>(path, init), card);
  },

  async replaceCard(
    card: WalletCard,
    reason: CardReplacementReason,
    idempotencyKey: string,
  ): Promise<WalletCard> {
    requireSandboxTestCardMutationRuntime();
    const { path, init } = buildCardReplaceRequest(card, reason, idempotencyKey);
    return normalizeCardReplaceResponse(await request<unknown>(path, init), card);
  },

  async updateCardStatus(
    card: WalletCard,
    action: CardStatusMutationAction,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<WalletCard> {
    requireSandboxTestCardMutationRuntime();
    const { path, init } = buildCardStatusMutationRequest(card, action, idempotencyKey, signal);
    const result = await request<unknown>(path, init);
    try {
      return normalizeCardStatusMutationResponse(result, card, action);
    } catch {
      throw new CardStatusMutationConfirmationError();
    }
  },

  async cardStatusMutationSnapshot(
    card: WalletCard,
    action: CardStatusMutationAction,
    expectedGeneration: WalletCard,
    signal?: AbortSignal,
  ): Promise<WalletCard> {
    requireSandboxTestCardMutationRuntime();
    const snapshot = await request<string>(
      `/v1/cards/${encodeURIComponent(card.cardId)}`,
      { signal },
      "text",
      CARD_ACTIVATION_MAX_RESPONSE_BYTES,
    );
    requireSandboxTestCardMutationRuntime();
    return normalizeCardStatusMutationSnapshot(snapshot, card, action, expectedGeneration);
  },

  async cardTransactions(
    session: BackendSession,
    cardId: string,
    query: WalletCardTransactionQuery = {},
    signal?: AbortSignal,
  ): Promise<WalletCardTransactionPage> {
    requireSandboxTestCardTransactionRuntime(session);
    const limit = query.limit ?? CARD_TRANSACTION_PAGE_SIZE;
    try {
      const result = await request<string>(
        buildCardTransactionPath(cardId, query),
        { signal },
        "text",
      );
      return normalizeCardTransactionResponse(result, limit, query.status);
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw new BackendApiError(
          error.status,
          error.traceId,
          `Card transaction request failed · Trace ${error.traceId}`,
        );
      }
      throw error;
    }
  },

  async cardTimeline(
    session: BackendSession,
    cardId: string,
    query: WalletCardTimelineQuery = {},
    signal?: AbortSignal,
  ): Promise<WalletCardTimelinePage> {
    requireSandboxTestCardTimelineRuntime(session);
    const limit = query.limit ?? CARD_TIMELINE_PAGE_SIZE;
    try {
      const result = await request<string>(
        buildCardTimelinePath(cardId, query),
        { signal },
        "text",
      );
      requireSandboxTestCardTimelineRuntime(session);
      return normalizeCardTimelineResponse(result, limit);
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw new BackendApiError(
          error.status,
          error.traceId,
          `Card timeline request failed · Trace ${error.traceId}`,
        );
      }
      throw error;
    }
  },

  async cardTransactionDetail(
    session: BackendSession,
    expectation: WalletCardTransactionDetailExpectation,
    signal?: AbortSignal,
  ): Promise<WalletCardTransaction> {
    requireSandboxTestCardTransactionRuntime(session);
    try {
      const result = await request<string>(
        buildCardTransactionDetailPath(expectation.cardId, expectation.transactionId),
        { signal },
        "text",
      );
      return normalizeCardTransactionDetailResponse(result, expectation);
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw new BackendApiError(
          error.status,
          error.traceId,
          `Card transaction detail request failed · Trace ${error.traceId}`,
        );
      }
      throw error;
    }
  },

  async walletBalanceAccounts(
    sessionEnvironment: FastLinkEnvironment,
    signal?: AbortSignal,
  ): Promise<WalletAssetAccount[]> {
    requireSandboxTestWalletBalanceRuntime(sessionEnvironment);
    return normalizeWalletBalanceResponse(
      await request<string>(WALLET_BALANCE_SUMMARY_PATH, { signal }, "text"),
    );
  },

  async walletTransferAccounts(
    session: BackendSession,
    signal?: AbortSignal,
  ): Promise<WalletTransferAccount[]> {
    requireSandboxTestWalletAccountReadRuntime(session);
    return normalizeWalletTransferAccountsResponse(
      await request<string>(
        "/v1/wallet/accounts",
        { signal },
        "text",
        WALLET_TRANSFER_ACCOUNT_MAX_JSON_BYTES,
      ),
    );
  },

  async createWalletTransfer(
    session: BackendSession,
    source: WalletTransferAccount,
    input: WalletTransferInput,
    idempotencyKey: string,
  ): Promise<WalletOperationActivity> {
    requireSandboxTestWalletRuntime(session);
    const { path, init } = buildWalletTransferRequest(source, input, idempotencyKey);
    return normalizeWalletTransferResponse(
      await request<string>(path, init, "text", WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES),
      source,
      input,
    );
  },

  async walletTransactions(
    session: BackendSession,
    query: WalletAccountTransactionQuery,
    signal?: AbortSignal,
  ): Promise<WalletAccountTransactionPage> {
    requireSandboxTestWalletTransactionRuntime(session);
    const limit = query.limit ?? WALLET_TRANSACTION_PAGE_SIZE;
    const result = await request<string>(buildWalletTransactionPath(query), { signal }, "text");
    return normalizeWalletTransactionResponse(result, query.assetCode, limit, query);
  },

  async walletTransactionDetail(
    session: BackendSession,
    expectation: WalletTransactionDetailExpectation,
    signal?: AbortSignal,
  ): Promise<WalletAccountTransaction> {
    requireSandboxTestWalletTransactionRuntime(session);
    const result = await request<unknown>(
      buildWalletTransactionDetailPath(expectation.transactionId),
      { signal },
    );
    return normalizeWalletTransactionDetail(result, expectation);
  },

  async walletOperations(
    session: BackendSession,
    query: WalletOperationActivityQuery = {},
    signal?: AbortSignal,
  ): Promise<WalletOperationActivityPage> {
    requireSandboxTestWalletRuntime(session);
    const result = await request<unknown>(buildWalletOperationPath(query), { signal });
    requireSandboxTestWalletRuntime(session);
    return normalizeWalletOperationResponse(result, query);
  },

  async walletOperationDetail(
    expectation: WalletOperationDetailExpectation,
  ): Promise<WalletOperationActivity> {
    const result = await request<unknown>(buildWalletOperationDetailPath(expectation.operationId));
    return normalizeWalletOperationDetail(result, expectation);
  },

  async walletTransferStatus(
    session: BackendSession,
    expectation: WalletTransferStatusExpectation,
  ): Promise<WalletOperationActivity> {
    requireSandboxTestWalletRuntime(session);
    const result = await request<string>(
      buildWalletOperationDetailPath(expectation.previous.id),
      {},
      "text",
      WALLET_TRANSFER_RESPONSE_MAX_JSON_BYTES,
    );
    return normalizeWalletTransferStatusResponse(result, expectation);
  },
};
