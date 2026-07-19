// Client-side fetch helper that attaches the current Supabase access token
// as `Authorization: Bearer <token>` so that same-origin `/api/*` routes can
// authenticate the caller. Falls back to a plain fetch when there is no
// active session (the server will then respond 401, as intended).
import { supabase } from "@/integrations/supabase/client";

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function authJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
