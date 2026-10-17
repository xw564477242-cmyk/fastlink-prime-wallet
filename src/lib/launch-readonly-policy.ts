// Product-mode narrowing only; server identity, permissions and RLS still apply.
import { walletRequestAllowed } from "../launch/b10-policy";
import { previewBrowserRequestAllowed } from "../launch/preview-readonly-policy";
import { resolveFrontendRuntime } from "./frontend-runtime";
export { walletRouteAllowed as launchRouteAllowed } from "../launch/b10-policy";

type ClientMode = "SDK_CONTRACT" | "B10_READ_ONLY" | "READ_ONLY_PREVIEW" | "BLOCKED";
type ClientModeInput = {
  apiUrl?: string;
  environment?: string;
  productMode?: string;
  previewMode?: string;
  candidateId?: string;
  previewBuild?: unknown;
};

// Build/product selection grants no actor, tenant, database or Provider permission.
export function resolveClientMode(input: ClientModeInput): ClientMode {
  if (resolveFrontendRuntime(input.apiUrl, input.environment).error) return "BLOCKED";
  if (input.previewBuild !== undefined && typeof input.previewBuild !== "boolean") return "BLOCKED";
  const previewIntent =
    input.previewBuild === true ||
    input.previewMode !== undefined ||
    input.candidateId !== undefined ||
    input.productMode === "READ_ONLY_PREVIEW";
  if (previewIntent) {
    return input.productMode === "READ_ONLY_PREVIEW" &&
      input.previewMode === "READ_ONLY" &&
      input.candidateId === "FL-LAUNCH-B13-20261017"
      ? "READ_ONLY_PREVIEW"
      : "BLOCKED";
  }
  if (input.productMode === "B10_READ_ONLY") return "B10_READ_ONLY";
  if (input.productMode === undefined || input.productMode === "SDK_CONTRACT")
    return "SDK_CONTRACT";
  return "BLOCKED";
}

// Complete existing SDK request families, not the first-release product allowlist.
const sdkId = "[A-Za-z0-9._:-]{1,128}";
const sdkRoutes: ReadonlyArray<{ method: string; path: RegExp; query?: readonly string[] }> = [
  { method: "POST", path: /^\/v1\/auth\/(register|login|refresh|logout)$/ },
  { method: "GET", path: /^\/v1\/session$/ },
  { method: "GET", path: /^\/v1\/cards$/, query: ["limit", "cursor"] },
  { method: "GET", path: new RegExp(`^/v1/cards/${sdkId}$`) },
  { method: "GET", path: new RegExp(`^/v1/cards/${sdkId}/(balance|limits)$`) },
  {
    method: "GET",
    path: new RegExp(`^/v1/cards/${sdkId}/transactions$`),
    query: ["limit", "cursor", "status"],
  },
  { method: "GET", path: new RegExp(`^/v1/cards/${sdkId}/timeline$`), query: ["limit", "cursor"] },
  { method: "GET", path: new RegExp(`^/v1/cards/${sdkId}/transactions/${sdkId}$`) },
  { method: "POST", path: /^\/v1\/cards\/virtual$/ },
  {
    method: "POST",
    path: new RegExp(`^/v1/cards/${sdkId}/(activate|renew|replace|freeze|unfreeze|limits)$`),
  },
  { method: "GET", path: /^\/v1\/wallet\/(assets|balances|accounts)$/ },
  {
    method: "GET",
    path: new RegExp(`^/v1/wallet/(transactions|accounts/${sdkId}/transactions)$`),
    query: ["assetCode", "limit", "cursor", "type", "status"],
  },
  { method: "GET", path: new RegExp(`^/v1/wallet/transactions/${sdkId}$`) },
  {
    method: "GET",
    path: /^\/v1\/wallet\/operations$/,
    query: ["limit", "cursor", "type", "status"],
  },
  { method: "GET", path: new RegExp(`^/v1/wallet/operations/${sdkId}$`) },
  { method: "POST", path: /^\/v1\/wallet\/(transfers|fx\/quotes)$/ },
];

function sdkTargetAllowed(target: string, method: string): boolean {
  if (method !== "GET" && method !== "POST") return false;
  const hasControl = (value: string) =>
    [...value].some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    );
  if (typeof target !== "string" || /[\\#]/.test(target) || hasControl(target)) return false;
  const [path, query, extra] = target.split("?");
  if (extra !== undefined || !path.startsWith("/v1/") || /%2f|%5c/i.test(path)) return false;
  try {
    const decoded = decodeURIComponent(path);
    if (
      /[%\\;#]/.test(decoded) ||
      hasControl(decoded) ||
      decoded.includes("//") ||
      decoded.split("/").some((part) => part === "." || part === "..")
    )
      return false;
    const route = sdkRoutes.find((entry) => entry.method === method && entry.path.test(decoded));
    if (!route || (method === "POST" && query !== undefined)) return false;
    const seen = new Set<string>();
    for (const [key, value] of new URLSearchParams(query ?? "")) {
      if (!route.query?.includes(key) || seen.has(key) || !value) return false;
      seen.add(key);
    }
    return true;
  } catch {
    return false;
  }
}

// One SDK transport guard; existing public SDK builders still validate each contract.
export function clientRequestAllowed(path: string, method = "GET"): boolean {
  const mode = resolveClientMode({
    apiUrl: import.meta.env.VITE_FASTLINK_API_URL,
    environment: import.meta.env.VITE_FASTLINK_ENVIRONMENT,
    productMode: import.meta.env.VITE_FASTLINK_PRODUCT_MODE,
    previewMode: import.meta.env.VITE_FASTLINK_PREVIEW_MODE,
    candidateId: import.meta.env.VITE_FASTLINK_CANDIDATE_ID,
    previewBuild: import.meta.env.FASTLINK_PREVIEW_BUILD,
  });
  if (mode === "SDK_CONTRACT") return sdkTargetAllowed(path, method);
  if (mode === "B10_READ_ONLY" || mode === "READ_ONLY_PREVIEW") {
    return launchRequestAllowed(path, method);
  }
  return false;
}

export function isLaunchReadOnlyPreview(): boolean {
  return import.meta.env.VITE_FASTLINK_PREVIEW_MODE === "READ_ONLY";
}

export function launchRequestAllowed(path: string, method = "GET"): boolean {
  if (!walletRequestAllowed(path, method)) return false;
  return !isLaunchReadOnlyPreview() || previewBrowserRequestAllowed(path, method);
}

export function safeCardFailure(error: unknown): string {
  const value = error as { status?: unknown; traceId?: unknown } | null;
  const status = typeof value?.status === "number" ? value.status : 0;
  const trace =
    typeof value?.traceId === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(value.traceId)
      ? value.traceId
      : "unavailable";
  const message =
    status === 401 || status === 403
      ? "身份已失效或无权查询，请重新登录"
      : status === 408
        ? "查询超时，请稍后手动刷新"
        : "卡查询不可用，请联系客服";
  return `${message} · HTTP ${status} · Trace ${trace}`;
}

export function supportReference(tenantId: string, environment: string, traceId: string): string {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(tenantId) ||
    !["SANDBOX", "TEST"].includes(environment) ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(traceId)
  )
    throw new Error("Invalid support reference");
  // No cookie, password, PAN, provider data or customer identity is included.
  // This is a lookup hint, NEVER an authorization token.
  return JSON.stringify({ version: 1, tenantId, environment, traceId });
}
