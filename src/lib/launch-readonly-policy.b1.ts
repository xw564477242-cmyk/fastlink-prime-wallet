// FL-LAUNCH-B1 candidate: a fixed product boundary, not a server permission grant.
export function launchRequestAllowed(path: string, method = "GET"): boolean {
  if (method === "POST")
    return ["/v1/auth/login", "/v1/auth/refresh", "/v1/auth/logout"].includes(path);
  if (method !== "GET") return false;
  return (
    path === "/v1/session" ||
    /^\/v1\/cards(?:\?limit=\d+(?:&cursor=[A-Za-z0-9%._~-]+)?)?$/.test(path)
  );
}

export function launchRouteAllowed(path: string): boolean {
  return path === "/cards" || path === "/auth";
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
