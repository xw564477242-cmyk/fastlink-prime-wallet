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
  amount: number;
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
  const rawStatus = requiredString(value.status, "status", 32).toLowerCase();
  if (
    !["authorized", "declined", "cleared", "settled", "reversed", "refunded"].includes(rawStatus)
  ) {
    throw new Error("Backend returned an invalid transaction status");
  }
  if (typeof value.amountMinor !== "string" || !/^-?\d+$/.test(value.amountMinor)) {
    throw new Error("Backend returned an invalid transaction amount");
  }
  const amountMinor = Number(value.amountMinor);
  if (!Number.isSafeInteger(amountMinor)) {
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
    status: rawStatus as WalletCardTransaction["status"],
    amount: amountMinor / 100,
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
};
