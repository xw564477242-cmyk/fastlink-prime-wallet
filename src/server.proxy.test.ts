import { afterEach, describe, expect, it, spyOn } from "bun:test";
import worker from "./server";

const origin = "https://backend.example.invalid";
const publicOrigin = "https://wallet.example.invalid";
const runtime = globalThis as typeof globalThis & { __env__?: Record<string, string> };
const originalRuntime = runtime.__env__;
const spies: Array<{ mockRestore(): void }> = [];

function upstream(response: Response) {
  const spy = spyOn(globalThis, "fetch").mockResolvedValue(response);
  spies.push(spy);
  return spy;
}

function request(path = "/api/diagnostic", init?: RequestInit) {
  return new Request(publicOrigin + path, init);
}

function environment(marker?: string) {
  return {
    FASTLINK_BACKEND_ORIGIN: origin,
    ...(marker === undefined ? {} : { FASTLINK_PROXY_ID: marker }),
  };
}

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
  if (originalRuntime === undefined) delete runtime.__env__;
  else runtime.__env__ = originalRuntime;
});

describe("Worker proxy identity compatibility", () => {
  it.each([
    ["prime-test", "prime-test"],
    ["  custom-diagnostic  ", "custom-diagnostic"],
    [undefined, "prime-dev"],
    ["", "prime-dev"],
    [" \t ", "prime-dev"],
  ])("uses configured/default marker %j without changing target", async (marker, expected) => {
    const fetchMock = upstream(
      new Response("ok", { headers: { "x-fastlink-api-proxy": "upstream-marker" } }),
    );
    const response = await worker.fetch(
      request("/api/diagnostic?q=a%2Fb&q=two"),
      environment(marker),
      {},
    );
    expect(response.headers.get("x-fastlink-api-proxy")).toBe(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe(origin + "/api/diagnostic?q=a%2Fb&q=two");
    expect(init?.redirect).toBe("manual");
    expect(await response.text()).toBe("ok");
  });

  it("preserves request method, body, Cookie and Authorization while rebuilding forwarded headers", async () => {
    const fetchMock = upstream(new Response("ok"));
    const response = await worker.fetch(
      request("/api/diagnostic?mode=echo", {
        method: "POST",
        body: "synthetic-payload",
        headers: {
          cookie: "session=synthetic-cookie",
          authorization: "Bearer synthetic-token",
          host: "attacker.invalid",
          forwarded: "host=attacker.invalid;proto=http",
          "x-forwarded-for": "192.0.2.1",
          "x-forwarded-host": "attacker.invalid",
          "x-forwarded-proto": "http",
          "x-fastlink-api-proxy": "prime-production",
        },
      }),
      environment("prime-test"),
      {},
    );
    const [target, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(target)).toBe(origin + "/api/diagnostic?mode=echo");
    expect(init?.method).toBe("POST");
    expect(await new Response(init?.body).text()).toBe("synthetic-payload");
    expect(headers.get("cookie")).toBe("session=synthetic-cookie");
    expect(headers.get("authorization")).toBe("Bearer synthetic-token");
    expect(headers.has("host")).toBe(false);
    expect(headers.has("forwarded")).toBe(false);
    expect(headers.has("x-forwarded-for")).toBe(false);
    expect(headers.get("x-forwarded-host")).toBe("wallet.example.invalid");
    expect(headers.get("x-forwarded-proto")).toBe("https");
    // Preserve existing forwarding; the client header never selects the server marker or target.
    expect(headers.get("x-fastlink-api-proxy")).toBe("prime-production");
    expect(response.headers.get("x-fastlink-api-proxy")).toBe("prime-test");
  });

  it.each([401, 403, 422, 503])(
    "preserves upstream error %i and cookies without authenticating locally",
    async (status) => {
      const fetchMock = upstream(
        new Response(' {"code":"synthetic-error"} ', {
          status,
          statusText: "Synthetic error",
          headers: {
            "content-type": "application/json",
            "set-cookie": "session=synthetic; HttpOnly; Secure; SameSite=Lax",
            "x-trace-id": "synthetic-trace",
            "cache-control": "public",
            "x-fastlink-api-proxy": "upstream-marker",
          },
        }),
      );
      const response = await worker.fetch(request(), environment("prime-test"), {});
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(status);
      expect(response.statusText).toBe("Synthetic error");
      expect(await response.text()).toBe(' {"code":"synthetic-error"} ');
      expect(response.headers.get("set-cookie")).toBe(
        "session=synthetic; HttpOnly; Secure; SameSite=Lax",
      );
      expect(response.headers.get("x-trace-id")).toBe("synthetic-trace");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-fastlink-api-proxy")).toBe("prime-test");
    },
  );

  it("does not follow upstream redirects", async () => {
    const fetchMock = upstream(
      new Response(null, { status: 302, headers: { location: "https://elsewhere.invalid/" } }),
    );
    const response = await worker.fetch(request(), environment(), {});
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://elsewhere.invalid/");
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("manual");
  });

  it("keeps the existing runtime-global fallback and direct environment precedence", async () => {
    runtime.__env__ = { FASTLINK_BACKEND_ORIGIN: origin, FASTLINK_PROXY_ID: "prime-test" };
    const fetchMock = upstream(new Response("ok"));
    const first = await worker.fetch(request(), {}, {});
    expect(first.headers.get("x-fastlink-api-proxy")).toBe("prime-test");
    fetchMock.mockResolvedValue(new Response("ok"));
    const second = await worker.fetch(
      request(),
      { FASTLINK_BACKEND_ORIGIN: "https://direct.example.invalid" },
      {},
    );
    expect(second.headers.get("x-fastlink-api-proxy")).toBe("prime-dev");
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://direct.example.invalid/api/diagnostic",
    );
  });

  it("cannot use a marker to bypass invalid backend-origin rejection", async () => {
    const fetchMock = upstream(new Response("must not be used"));
    const log = spyOn(console, "error").mockImplementation(() => {});
    spies.push(log);
    const response = await worker.fetch(
      request(),
      {
        FASTLINK_BACKEND_ORIGIN: "http://invalid.example.invalid/path",
        FASTLINK_PROXY_ID: "prime-test",
      },
      {},
    );
    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves network exception handling", async () => {
    const fetchMock = upstream(new Response("unused"));
    fetchMock.mockRejectedValue(new Error("synthetic network failure"));
    const log = spyOn(console, "error").mockImplementation(() => {});
    spies.push(log);
    const response = await worker.fetch(request(), environment("prime-test"), {});
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("This page didn't load");
  });

  it("keeps readyz identity tied to build environment and SHA, with no proxy fetch", async () => {
    const fetchMock = upstream(new Response("unused"));
    const response = await worker.fetch(
      new Request(publicOrigin + "/readyz"),
      environment("prime-production"),
      {},
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.has("x-fastlink-api-proxy")).toBe(false);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      service: "fastlink-prime-wallet",
      environment: process.env.VITE_FASTLINK_ENVIRONMENT,
      buildSha: process.env.VITE_FASTLINK_BUILD_SHA,
      production: false,
    });
  });
});
