import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type WorkerEnvironment = {
  FASTLINK_BACKEND_ORIGIN?: string;
  FASTLINK_PROXY_ID?: string;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function resolveWorkerEnvironment(env: unknown): WorkerEnvironment {
  const direct = (env ?? {}) as WorkerEnvironment;
  if (direct.FASTLINK_BACKEND_ORIGIN) return direct;
  const runtimeGlobal = globalThis as typeof globalThis & {
    __env__?: WorkerEnvironment;
  };
  return runtimeGlobal.__env__ ?? direct;
}

function requireBackendOrigin(env: WorkerEnvironment): URL {
  const configured = env.FASTLINK_BACKEND_ORIGIN?.trim();
  if (!configured) throw new Error("FASTLINK_BACKEND_ORIGIN is not configured");
  const origin = new URL(configured);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("FASTLINK_BACKEND_ORIGIN must be an HTTPS origin without a path");
  }
  return origin;
}

function proxyHeaders(request: Request, publicUrl: URL): Headers {
  const headers = new Headers(request.headers);
  for (const name of [
    "host",
    "origin",
    "referer",
    "forwarded",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
  ]) {
    headers.delete(name);
  }
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", "https");
  return headers;
}

async function proxyBackendRequest(request: Request, env: WorkerEnvironment): Promise<Response> {
  const publicUrl = new URL(request.url);
  const backendUrl = requireBackendOrigin(env);
  backendUrl.pathname = publicUrl.pathname;
  backendUrl.search = publicUrl.search;
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: proxyHeaders(request, publicUrl),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-fastlink-api-proxy", env.FASTLINK_PROXY_ID?.trim() || "prime-production");
  headers.set("x-fastlink-environment", "PRODUCTION");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        return await proxyBackendRequest(request, resolveWorkerEnvironment(env));
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
