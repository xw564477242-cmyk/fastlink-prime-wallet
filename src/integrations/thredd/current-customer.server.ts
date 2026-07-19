// Server-only helper to resolve the current customer id from a real
// Supabase-authenticated request. The Supabase user id is used as the
// FastLink/Thredd customer id (1:1 mapping in this app).

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "forbidden") {
    super(message);
  }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify the Supabase session bearer token on `request` and return the
 * authenticated user id. Throws `UnauthorizedError` when the token is
 * missing, malformed, expired, or otherwise invalid.
 */
export async function requireCustomerId(request: Request): Promise<string> {
  const token = extractBearer(request);
  if (!token) throw new UnauthorizedError("missing_bearer_token");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new UnauthorizedError("invalid_session");
  return data.user.id;
}

/**
 * Standard error-to-Response mapping for API handlers. Turns auth errors
 * into 401/403 and everything else into a generic 500 with the message.
 */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message }, { status: 403 });
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status <= 599
  ) {
    const message = err instanceof Error ? err.message : "request_failed";
    return Response.json({ error: message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "server_error";
  return Response.json({ error: message }, { status: 500 });
}

/**
 * Assert that the given card is owned by `customerId`. Loads the card via
 * the mock card service (which is what all endpoints use here) and throws
 * `ForbiddenError` on mismatch, `UnauthorizedError`-adjacent on missing.
 */
export async function assertOwnsCard(cardId: string, customerId: string): Promise<void> {
  const { cardService } = await import("./thredd.card.service");
  const detail = await cardService.getCardDetail(cardId).catch(() => null);
  if (!detail) throw new ForbiddenError("card_not_found_or_forbidden");
  if (detail.customerId !== customerId) throw new ForbiddenError("not_card_owner");
}
