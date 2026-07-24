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
  if (configuredEnvironment === "PRODUCTION" && !apiUrl.startsWith("https://")) {
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

export type WalletCardTransaction = {
  id: string;
  status: "authorized" | "declined" | "cleared" | "settled" | "reversed" | "refunded";
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  timestamp: string;
  traceId?: string;
};

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

type BackendTransactionRecord = {
  id?: unknown;
  status?: unknown;
  amountMinor?: unknown;
  currency?: unknown;
  merchantName?: unknown;
  merchantCategory?: unknown;
  occurredAt?: unknown;
  traceId?: unknown;
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

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const runtime = requireRuntime();
  const requestTraceId = traceId();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Trace-Id", requestTraceId);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${runtime.apiUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "omit",
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

function normalizeTransaction(value: BackendTransactionRecord): WalletCardTransaction {
  const rawStatus = String(value.status ?? "").toLowerCase();
  const status = ["authorized", "declined", "cleared", "settled", "reversed", "refunded"].includes(
    rawStatus,
  )
    ? (rawStatus as WalletCardTransaction["status"])
    : "authorized";
  const amountMinor = Number(value.amountMinor ?? 0);
  return {
    id: String(value.id ?? ""),
    status,
    amount: Number.isFinite(amountMinor) ? amountMinor / 100 : 0,
    currency: String(value.currency ?? "—"),
    merchant:
      typeof value.merchantName === "string" && value.merchantName
        ? value.merchantName
        : "Card transaction",
    category: typeof value.merchantCategory === "string" ? value.merchantCategory : "",
    timestamp: typeof value.occurredAt === "string" ? value.occurredAt : new Date(0).toISOString(),
    traceId: typeof value.traceId === "string" ? value.traceId : undefined,
  };
}

export const backendApi = {
  session(token: string) {
    return request<BackendSession>("/v1/session", token);
  },

  async listCards(token: string): Promise<WalletCard[]> {
    const cards = await request<BackendCardRecord[]>("/v1/cards", token);
    return cards.map(normalizeCard);
  },

  async getCard(token: string, cardId: string): Promise<WalletCard> {
    const card = await request<BackendCardRecord>(`/v1/cards/${encodeURIComponent(cardId)}`, token);
    return normalizeCard(card);
  },

  async createVirtualCard(
    token: string,
    input: { currency: string; alias?: string },
  ): Promise<WalletCard> {
    const card = await request<BackendCardRecord>("/v1/cards/virtual", token, {
      method: "POST",
      headers: { "Idempotency-Key": traceId() },
      body: JSON.stringify(input),
    });
    return normalizeCard(card);
  },

  async setFrozen(token: string, cardId: string, frozen: boolean): Promise<WalletCard> {
    const card = await request<BackendCardRecord>(
      `/v1/cards/${encodeURIComponent(cardId)}/${frozen ? "freeze" : "unfreeze"}`,
      token,
      {
        method: "POST",
        headers: { "Idempotency-Key": traceId() },
      },
    );
    return normalizeCard(card);
  },

  async cardTransactions(token: string, cardId: string): Promise<WalletCardTransaction[]> {
    const result = await request<{ transactions?: BackendTransactionRecord[] }>(
      `/v1/cards/${encodeURIComponent(cardId)}/transactions`,
      token,
    );
    return (result.transactions ?? []).map(normalizeTransaction);
  },
};
