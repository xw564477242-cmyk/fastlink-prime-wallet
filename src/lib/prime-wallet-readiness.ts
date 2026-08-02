export type PrimeWalletReadinessRuntime = Readonly<{
  environment?: string;
  buildSha?: string;
}>;

const SERVICE = "fastlink-prime-wallet";
const READY_ENVIRONMENTS = new Set(["SANDBOX", "TEST"]);
const BUILD_SHA_PATTERN = /^[a-f0-9]{40}$/;

function responseHeaders(): Headers {
  return new Headers({
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
}

function jsonResponse(request: Request, status: number, payload: object, allow?: string): Response {
  const headers = responseHeaders();
  if (allow) headers.set("allow", allow);
  return new Response(request.method === "HEAD" ? null : JSON.stringify(payload), {
    status,
    headers,
  });
}

export function primeWalletReadinessResponse(
  request: Request,
  runtime: PrimeWalletReadinessRuntime,
): Response {
  const url = new URL(request.url);
  if (url.pathname !== "/readyz" || url.search || url.hash) {
    return jsonResponse(request, 400, { status: "invalid_request", service: SERVICE });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse(
      request,
      405,
      { status: "method_not_allowed", service: SERVICE },
      "GET, HEAD",
    );
  }

  const environment = runtime.environment?.trim();
  const buildSha = runtime.buildSha?.trim().toLowerCase();
  if (
    !environment ||
    !READY_ENVIRONMENTS.has(environment) ||
    !buildSha ||
    !BUILD_SHA_PATTERN.test(buildSha)
  ) {
    return jsonResponse(request, 503, { status: "not_ready", service: SERVICE });
  }

  return jsonResponse(request, 200, {
    status: "ready",
    service: SERVICE,
    environment,
    buildSha,
  });
}
