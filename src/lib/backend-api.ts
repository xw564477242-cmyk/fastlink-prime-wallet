export type FastLinkEnvironment = "LOCAL" | "SANDBOX" | "UAT" | "PRODUCTION";

const allowedEnvironments: FastLinkEnvironment[] = ["LOCAL", "SANDBOX", "UAT", "PRODUCTION"];

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
      error: "VITE_FASTLINK_ENVIRONMENT must be LOCAL, SANDBOX, UAT, or PRODUCTION",
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
  currency: string;
  alias?: string;
  balance: number;
  capabilities: {
    freeze: boolean;
    unfreeze: boolean;
    replace: boolean;
    renew: boolean;
    updateLimits: boolean;
  };
};

export type WalletCardPage = {
  cards: WalletCard[];
  nextCursor: string | null;
};

export type WalletCardListQuery = {
  limit?: number;
  cursor?: string;
};

export const CARD_LIST_PAGE_SIZE = 20;

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
};

export const CARD_TRANSACTION_PAGE_SIZE = 25;

export type WalletAssetAccount = {
  assetCode: string;
  availableBalance: string;
  ledgerBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

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

export type WalletAccountTransactionQuery = {
  assetCode: string;
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

export type WalletOperationActivityQuery = {
  limit?: number;
  cursor?: string;
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
  capabilities?: Record<string, unknown>;
};

type BackendCardPageRecord = {
  cards?: unknown;
  nextCursor?: unknown;
};

type BackendTransactionRecord = {
  id?: unknown;
  status?: unknown;
  amountMinor?: unknown;
  currency?: unknown;
  merchantName?: unknown;
  merchantCategory?: unknown;
  occurredAt?: unknown;
};

type BackendTransactionPageRecord = {
  transactions?: unknown;
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

type BackendWalletOperationRecord = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  assetCode?: unknown;
  amount?: unknown;
  direction?: unknown;
  createdAt?: unknown;
  completedAt?: unknown;
  updatedAt?: unknown;
};

type BackendWalletOperationPageRecord = {
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = `Backend request failed with HTTP ${response.status}`;
      throw new BackendApiError(
        response.status,
        returnedTraceId,
        `${parseMessage(payload, fallback)} · Trace ${returnedTraceId}`,
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
  const minor = Number(value.availableBalanceMinor ?? 0);
  const capabilities = value.capabilities ?? {};

  return {
    cardId: id,
    type,
    status: normalizeStatus(value.status),
    last4: typeof value.last4 === "string" ? value.last4 : "",
    expiry:
      Number.isInteger(month) && Number.isInteger(year)
        ? `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`
        : "—",
    currency: typeof value.currency === "string" ? value.currency : "—",
    alias: typeof value.alias === "string" ? value.alias : undefined,
    balance: Number.isFinite(minor) ? minor / 100 : 0,
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

function normalizeTransaction(value: BackendTransactionRecord): WalletCardTransaction {
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid transaction");
  }
  const rawStatus = requiredString(value.status, "status", 32);
  if (
    !["AUTHORIZED", "DECLINED", "CLEARED", "SETTLED", "REVERSED", "REFUNDED"].includes(rawStatus)
  ) {
    throw new Error("Backend returned an invalid transaction status");
  }
  if (typeof value.amountMinor !== "string" || !/^(?:0|-?[1-9]\d{0,18})$/.test(value.amountMinor)) {
    throw new Error("Backend returned an invalid transaction amount");
  }
  const amountMinor = BigInt(value.amountMinor);
  if (amountMinor < -9_223_372_036_854_775_808n || amountMinor > 9_223_372_036_854_775_807n) {
    throw new Error("Backend returned an invalid transaction amount");
  }
  const currency = requiredString(value.currency, "currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Backend returned an invalid transaction currency");
  }
  const timestamp = requiredString(value.occurredAt, "timestamp", 64);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error("Backend returned an invalid transaction timestamp");
  }
  return {
    id: requiredString(value.id, "id", 128),
    status: rawStatus.toLowerCase() as WalletCardTransaction["status"],
    amountMinor: value.amountMinor,
    currency,
    merchant: optionalString(value.merchantName, "merchant", 160) || "Card transaction",
    category: optionalString(value.merchantCategory, "category", 64),
    timestamp,
  };
}

export function buildCardTransactionPath(
  cardId: string,
  query: WalletCardTransactionQuery = {},
): string {
  const containsControlCharacter = [...cardId].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!cardId.trim() || cardId.length > 128 || containsControlCharacter) {
    throw new Error("Invalid card transaction card id");
  }
  const limit = query.limit ?? CARD_TRANSACTION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TRANSACTION_PAGE_SIZE) {
    throw new Error(`Card transaction limit must be between 1 and ${CARD_TRANSACTION_PAGE_SIZE}`);
  }
  if (
    query.cursor !== undefined &&
    (!query.cursor || query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
  ) {
    throw new Error("Invalid card transaction cursor");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/cards/${encodeURIComponent(cardId)}/transactions?${params.toString()}`;
}

export function normalizeCardTransactionResponse(
  value: unknown,
  limit = CARD_TRANSACTION_PAGE_SIZE,
): WalletCardTransactionPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > CARD_TRANSACTION_PAGE_SIZE) {
    throw new Error(`Card transaction limit must be between 1 and ${CARD_TRANSACTION_PAGE_SIZE}`);
  }
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid transaction page");
  }
  const page = value as BackendTransactionPageRecord;
  if (!Array.isArray(page.transactions) || page.transactions.length > limit) {
    throw new Error("Backend returned an invalid transaction page");
  }
  if (
    page.nextCursor !== null &&
    (typeof page.nextCursor !== "string" ||
      !page.nextCursor ||
      page.nextCursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))
  ) {
    throw new Error("Backend returned an invalid transaction cursor");
  }
  return {
    transactions: page.transactions.map((transaction) =>
      normalizeTransaction(transaction as BackendTransactionRecord),
    ),
    nextCursor: page.nextCursor,
  };
}

function walletAssetCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z0-9]{2,12}$/.test(value)) {
    throw new Error("Backend returned an invalid Wallet asset code");
  }
  return value;
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

export function normalizeWalletBalanceResponse(value: unknown): WalletAssetAccount[] {
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid Wallet balance response");
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > 50) {
    throw new Error("Backend returned an invalid Wallet balance response");
  }
  return items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Backend returned an invalid Wallet balance account");
    }
    const record = item as BackendWalletBalanceRecord;
    return {
      assetCode: walletAssetCode(record.assetCode),
      availableBalance: walletDecimal(record.availableBalance, "available balance"),
      ledgerBalance: walletDecimal(record.ledgerBalance, "ledger balance"),
      pendingBalance: walletDecimal(record.pendingBalance, "pending balance"),
      updatedAt: walletTimestamp(record.updatedAt, "balance timestamp"),
    };
  });
}

export function buildWalletTransactionPath(query: WalletAccountTransactionQuery): string {
  const assetCode = walletAssetCode(query.assetCode);
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
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/wallet/transactions?${params.toString()}`;
}

function normalizeWalletTransaction(value: unknown): WalletAccountTransaction {
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid Wallet transaction");
  }
  const record = value as BackendWalletTransactionRecord;
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

export function buildWalletOperationPath(query: WalletOperationActivityQuery = {}): string {
  const limit = query.limit ?? WALLET_OPERATION_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_OPERATION_PAGE_SIZE) {
    throw new Error(`Wallet operation limit must be between 1 and ${WALLET_OPERATION_PAGE_SIZE}`);
  }
  if (
    query.cursor !== undefined &&
    (!query.cursor || query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor))
  ) {
    throw new Error("Invalid Wallet operation cursor");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) params.set("cursor", query.cursor);
  return `/v1/wallet/operations?${params.toString()}`;
}

function normalizeWalletOperation(value: unknown): WalletOperationActivity {
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid Wallet operation");
  }
  const record = value as BackendWalletOperationRecord;
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

export function normalizeWalletOperationResponse(
  value: unknown,
  limit = WALLET_OPERATION_PAGE_SIZE,
): WalletOperationActivityPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_OPERATION_PAGE_SIZE) {
    throw new Error(`Wallet operation limit must be between 1 and ${WALLET_OPERATION_PAGE_SIZE}`);
  }
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid Wallet operation page");
  }
  const page = value as BackendWalletOperationPageRecord;
  if (!Array.isArray(page.items) || page.items.length > limit) {
    throw new Error("Backend returned an invalid Wallet operation page");
  }
  if (
    page.nextCursor !== null &&
    (typeof page.nextCursor !== "string" ||
      !page.nextCursor ||
      page.nextCursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))
  ) {
    throw new Error("Backend returned an invalid Wallet operation cursor");
  }
  const items = page.items.map(normalizeWalletOperation);
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) {
    throw new Error("Backend returned duplicate Wallet operation ids");
  }
  return { items, nextCursor: page.nextCursor };
}

export function normalizeWalletTransactionResponse(
  value: unknown,
  expectedAssetCode: string,
  limit = WALLET_TRANSACTION_PAGE_SIZE,
): WalletAccountTransactionPage {
  const assetCode = walletAssetCode(expectedAssetCode);
  if (!Number.isInteger(limit) || limit < 1 || limit > WALLET_TRANSACTION_PAGE_SIZE) {
    throw new Error(
      `Wallet transaction limit must be between 1 and ${WALLET_TRANSACTION_PAGE_SIZE}`,
    );
  }
  if (!value || typeof value !== "object") {
    throw new Error("Backend returned an invalid Wallet transaction page");
  }
  const page = value as BackendWalletTransactionPageRecord;
  if (!Array.isArray(page.items) || page.items.length > limit) {
    throw new Error("Backend returned an invalid Wallet transaction page");
  }
  if (
    page.nextCursor !== null &&
    (typeof page.nextCursor !== "string" ||
      !page.nextCursor ||
      page.nextCursor.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(page.nextCursor))
  ) {
    throw new Error("Backend returned an invalid Wallet transaction cursor");
  }
  const items = page.items.map(normalizeWalletTransaction);
  if (items.some((item) => item.assetCode !== assetCode)) {
    throw new Error("Backend returned a Wallet transaction outside the selected account");
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

  async listCards(query: WalletCardListQuery = {}): Promise<WalletCardPage> {
    const limit = query.limit ?? CARD_LIST_PAGE_SIZE;
    const page = await request<unknown>(buildCardListPath(query));
    return normalizeCardListResponse(page, limit);
  },

  async getCard(cardId: string): Promise<WalletCard> {
    const card = await request<BackendCardRecord>(`/v1/cards/${encodeURIComponent(cardId)}`);
    return normalizeCard(card);
  },

  async createVirtualCard(input: { currency: string; alias?: string }): Promise<WalletCard> {
    const card = await request<BackendCardRecord>("/v1/cards/virtual", {
      method: "POST",
      headers: { "Idempotency-Key": traceId() },
      body: JSON.stringify(input),
    });
    return normalizeCard(card);
  },

  async setFrozen(cardId: string, frozen: boolean): Promise<WalletCard> {
    const card = await request<BackendCardRecord>(
      `/v1/cards/${encodeURIComponent(cardId)}/${frozen ? "freeze" : "unfreeze"}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": traceId() },
      },
    );
    return normalizeCard(card);
  },

  async cardTransactions(
    cardId: string,
    query: WalletCardTransactionQuery = {},
  ): Promise<WalletCardTransactionPage> {
    const limit = query.limit ?? CARD_TRANSACTION_PAGE_SIZE;
    const result = await request<unknown>(buildCardTransactionPath(cardId, query));
    return normalizeCardTransactionResponse(result, limit);
  },

  async walletBalanceAccounts(): Promise<WalletAssetAccount[]> {
    return normalizeWalletBalanceResponse(await request<unknown>("/v1/wallet/balances"));
  },

  async walletTransactions(
    query: WalletAccountTransactionQuery,
  ): Promise<WalletAccountTransactionPage> {
    const limit = query.limit ?? WALLET_TRANSACTION_PAGE_SIZE;
    const result = await request<unknown>(buildWalletTransactionPath(query));
    return normalizeWalletTransactionResponse(result, query.assetCode, limit);
  },

  async walletTransactionDetail(
    expectation: WalletTransactionDetailExpectation,
  ): Promise<WalletAccountTransaction> {
    const result = await request<unknown>(
      buildWalletTransactionDetailPath(expectation.transactionId),
    );
    return normalizeWalletTransactionDetail(result, expectation);
  },

  async walletOperations(
    query: WalletOperationActivityQuery = {},
  ): Promise<WalletOperationActivityPage> {
    const limit = query.limit ?? WALLET_OPERATION_PAGE_SIZE;
    const result = await request<unknown>(buildWalletOperationPath(query));
    return normalizeWalletOperationResponse(result, limit);
  },
};
