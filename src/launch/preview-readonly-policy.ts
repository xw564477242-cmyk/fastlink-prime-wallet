import { serverRequestAllowed } from "./b10-policy.js";

export function previewRequestAllowed(target: string, method = "GET", scope?: string): boolean {
  if (!serverRequestAllowed(target, method)) return false;
  if (scope !== undefined && scope !== "WALLET_ONLY") return false;
  if (scope === "WALLET_ONLY") {
    const path = target.split("?")[0];
    return method === "GET"
      ? /^\/api\/v1\/(?:session|cards(?:\/[A-Za-z0-9._:-]{1,128})?|wallet\/(?:assets|balances|transactions(?:\/[A-Za-z0-9._:-]{1,128})?))$/.test(
          path,
        )
      : method === "POST" && /^\/api\/v1\/auth\/(?:login|logout|refresh)$/.test(path);
  }
  if (method === "GET") return true;
  return (
    method === "POST" &&
    /^\/api\/(?:v1\/auth\/(?:login|logout|refresh)|admin\/auth\/(?:login|logout))$/.test(target)
  );
}

export function previewBrowserRequestAllowed(
  target: string,
  method = "GET",
  scope?: string,
): boolean {
  return previewRequestAllowed(
    target.startsWith("/api/") ? target : "/api" + target,
    method,
    scope,
  );
}
