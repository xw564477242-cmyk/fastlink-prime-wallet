import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  verifyPrimeWalletReadiness,
  verifyPrimeWalletReadinessWithRetry,
} from "./verify-prime-wallet-readiness.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const devWorkflow = read(".github/workflows/deploy-cloudflare-dev.yml");
const testWorkflow = read(".github/workflows/deploy-cloudflare-test.yml");
const server = read("src/server.ts");
const devConfig = read("wrangler.dev.jsonc");
const testConfig = read("wrangler.test.jsonc");
const SHA = "b".repeat(40);

test("keeps Dev and Test acceptance on the sanitized readiness contract", () => {
  assert.doesNotMatch(devWorkflow, /\/api\/health\b/);
  assert.doesNotMatch(testWorkflow, /\/api\/health\b/);
  assert.match(
    devWorkflow,
    /verify-prime-wallet-readiness\.mjs "\$base" SANDBOX "\$\{\{ github\.sha \}\}"/,
  );
  assert.match(
    testWorkflow,
    /verify-prime-wallet-readiness\.mjs "\$PRIME_WALLET_URL" TEST "\$\{\{ github\.sha \}\}"/,
  );
  assert.match(testWorkflow, /FASTLINK_PRIME_TEST_DEPLOY_ENABLED == 'true'/);
  assert.doesNotMatch(testWorkflow, /-\s+(?:main|production)\b/i);
  assert.doesNotMatch(devConfig, /production/i);
  assert.doesNotMatch(testConfig, /production/i);
  assert.match(testConfig, /"name": "fastlink-prime-wallet-test"/);
  assert.match(server, /pathname === "\/readyz"/);
  assert.ok(server.indexOf('pathname === "/readyz"') < server.indexOf('pathname === "/api"'));
});

test("verifies exact SANDBOX and TEST identities without credentials", async () => {
  for (const environment of ["SANDBOX", "TEST"]) {
    let observed;
    const result = await verifyPrimeWalletReadiness(
      "https://prime-wallet.fastlink.invalid",
      environment,
      SHA,
      async (url, init) => {
        observed = { url: String(url), init };
        return Response.json(
          {
            status: "ready",
            service: "fastlink-prime-wallet",
            environment,
            buildSha: SHA,
            production: false,
          },
          {
            headers: {
              "cache-control": "no-store, max-age=0",
              "x-content-type-options": "nosniff",
            },
          },
        );
      },
    );
    assert.deepEqual(result, { environment, buildSha: SHA, production: false, verified: true });
    assert.equal(observed.url, "https://prime-wallet.fastlink.invalid/readyz");
    assert.deepEqual(observed.init.headers, { accept: "application/json" });
    assert.equal(observed.init.cache, "no-store");
    assert.equal(observed.init.redirect, "error");
    assert.equal(observed.init.signal instanceof AbortSignal, true);
  }
});

test("retries a bounded transient rollout failure and accepts the exact deployed identity", async () => {
  let calls = 0;
  const delays = [];
  const result = await verifyPrimeWalletReadinessWithRetry(
    "https://prime-wallet.fastlink.invalid",
    "SANDBOX",
    SHA,
    {
      attempts: 3,
      delayMs: 25,
      sleep: async (milliseconds) => delays.push(milliseconds),
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response(null, { status: 500 });
        return Response.json(
          {
            status: "ready",
            service: "fastlink-prime-wallet",
            environment: "SANDBOX",
            buildSha: SHA,
            production: false,
          },
          {
            headers: {
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          },
        );
      },
    },
  );

  assert.deepEqual(result, {
    environment: "SANDBOX",
    buildSha: SHA,
    production: false,
    verified: true,
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [25]);
});

test("rejects Production and any response that exposes an extra field", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({});
  };
  await assert.rejects(
    verifyPrimeWalletReadiness(
      "https://prime-wallet.fastlink.invalid",
      "PRODUCTION",
      SHA,
      fetchImpl,
    ),
    /SANDBOX or TEST/,
  );
  assert.equal(calls, 0);

  await assert.rejects(
    verifyPrimeWalletReadiness("https://prime-wallet.fastlink.invalid", "TEST", SHA, async () =>
      Response.json(
        {
          status: "ready",
          service: "fastlink-prime-wallet",
          environment: "TEST",
          buildSha: SHA,
          production: false,
          backendUrl: "https://private-backend.invalid",
        },
        { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
      ),
    ),
    /field set drifted/,
  );

  await assert.rejects(
    verifyPrimeWalletReadiness("https://prime-wallet.fastlink.invalid", "TEST", SHA, async () =>
      Response.json(
        {
          status: "ready",
          service: "fastlink-prime-wallet",
          environment: "TEST",
          buildSha: SHA,
          production: true,
        },
        { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
      ),
    ),
    /identity does not match/,
  );
});

test("fails closed and actively cancels a response after the 1 KiB boundary", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    verifyPrimeWalletReadiness(
      "https://prime-wallet.fastlink.invalid",
      "TEST",
      SHA,
      async () =>
        new Response(body, {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        }),
    ),
    /response is oversized/,
  );
  assert.equal(cancelled, true);
});

test("actively cancels an oversized declared body without parsing it", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    verifyPrimeWalletReadiness(
      "https://prime-wallet.fastlink.invalid",
      "SANDBOX",
      SHA,
      async () =>
        new Response(body, {
          headers: {
            "content-type": "application/json",
            "content-length": "1025",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        }),
    ),
    /response is oversized/,
  );
  assert.equal(cancelled, true);
});

test("rejects lookalike media types and cache directives", async () => {
  const payload = {
    status: "ready",
    service: "fastlink-prime-wallet",
    environment: "TEST",
    buildSha: SHA,
    production: false,
  };
  await assert.rejects(
    verifyPrimeWalletReadiness("https://prime-wallet.fastlink.invalid", "TEST", SHA, async () =>
      Response.json(payload, {
        headers: {
          "content-type": "application/json-secret",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      }),
    ),
    /response is not JSON/,
  );
  await assert.rejects(
    verifyPrimeWalletReadiness("https://prime-wallet.fastlink.invalid", "TEST", SHA, async () =>
      Response.json(payload, {
        headers: {
          "cache-control": "x-no-store",
          "x-content-type-options": "nosniff",
        },
      }),
    ),
    /response is cacheable/,
  );
});
