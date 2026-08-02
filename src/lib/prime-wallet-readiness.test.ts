import { describe, expect, it } from "bun:test";

import { primeWalletReadinessResponse } from "./prime-wallet-readiness";

const SHA = "a".repeat(40);

describe("Prime Wallet non-production readiness", () => {
  for (const environment of ["SANDBOX", "TEST"] as const) {
    it(`returns one exact credential-free ${environment} contract`, async () => {
      const request = new Request("https://prime-wallet.fastlink.invalid/readyz", {
        headers: {
          authorization: "Bearer ignored-by-readiness",
          cookie: "private=cookie-is-never-read",
        },
      });
      const response = primeWalletReadinessResponse(request, { environment, buildSha: SHA });

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(await response.json()).toEqual({
        status: "ready",
        service: "fastlink-prime-wallet",
        environment,
        buildSha: SHA,
      });
    });
  }

  it("supports bodyless HEAD and rejects query or mutation methods", async () => {
    const runtime = { environment: "SANDBOX", buildSha: SHA };
    const head = primeWalletReadinessResponse(
      new Request("https://prime-wallet.fastlink.invalid/readyz", { method: "HEAD" }),
      runtime,
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");

    const query = primeWalletReadinessResponse(
      new Request("https://prime-wallet.fastlink.invalid/readyz?verbose=true"),
      runtime,
    );
    expect(query.status).toBe(400);
    expect(await query.json()).toEqual({
      status: "invalid_request",
      service: "fastlink-prime-wallet",
    });

    const post = primeWalletReadinessResponse(
      new Request("https://prime-wallet.fastlink.invalid/readyz", { method: "POST" }),
      runtime,
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });

  it("fails closed without disclosing runtime details outside SANDBOX and TEST", async () => {
    for (const runtime of [
      {},
      { environment: "PRODUCTION", buildSha: SHA },
      { environment: "LOCAL", buildSha: SHA },
      { environment: "SANDBOX", buildSha: "not-a-real-build" },
    ]) {
      const response = primeWalletReadinessResponse(
        new Request("https://prime-wallet.fastlink.invalid/readyz"),
        runtime,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        status: "not_ready",
        service: "fastlink-prime-wallet",
      });
    }
  });
});
