export function platformApiEnabled(): boolean {
  return Boolean(process.env.FASTLINK_BACKEND_URL);
}

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function platformFetch(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = process.env.FASTLINK_BACKEND_URL;
  if (!baseUrl) throw new Error("platform_api_not_configured");
  const headers = new Headers(init.headers);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  headers.set("content-type", "application/json");
  return fetch(new URL(path, `${baseUrl.replace(/\/$/, "")}/`), { ...init, headers });
}

export async function forwardPlatformJson(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => ({ error: "platform_response_invalid" }));
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String(body.message)
        : "platform_request_failed";
    throw new PlatformApiError(message, response.status);
  }
  return body;
}
