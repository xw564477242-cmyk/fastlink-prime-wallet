// HTTP client for the Thredd API. Server-only — never import from client code.
// Reads credentials from env inside methods so Cloudflare Workers can inject
// them at request time.

import type { ThreddApiError } from "./thredd.types";

export interface ThreddClientOptions {
  baseUrl: string;
  apiKey: string;
  programId?: string;
  issuerId?: string;
}

export function isMockMode(): boolean {
  const flag = process.env.THREDD_MOCK;
  if (flag && flag.toLowerCase() === "true") return true;
  // Default to mock when no API key is configured.
  return !process.env.THREDD_API_KEY;
}

export function getThreddOptions(): ThreddClientOptions {
  const baseUrl = process.env.THREDD_BASE_URL ?? "https://api.thredd.com";
  const apiKey = process.env.THREDD_API_KEY ?? "";
  return {
    baseUrl,
    apiKey,
    programId: process.env.THREDD_PROGRAM_ID,
    issuerId: process.env.THREDD_ISSUER_ID,
  };
}

export async function threddFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const opts = getThreddOptions();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, opts.baseUrl);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${opts.apiKey}`);
  headers.set("Content-Type", "application/json");
  if (opts.programId) headers.set("X-Program-Id", opts.programId);
  if (opts.issuerId) headers.set("X-Issuer-Id", opts.issuerId);

  const res = await fetch(url.toString(), { ...init, headers });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (body as { error?: ThreddApiError })?.error ?? {
      code: `http_${res.status}`,
      message: res.statusText,
    };
    throw new ThreddError(err.code, err.message, res.status, err.details);
  }
  return body as T;
}

export class ThreddError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
