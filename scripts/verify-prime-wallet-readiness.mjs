import { pathToFileURL } from "node:url";

const ENVIRONMENTS = new Set(["SANDBOX", "TEST"]);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const EXPECTED_KEYS = ["buildSha", "environment", "production", "service", "status"];
const MAX_RESPONSE_BYTES = 1_024;

function fail(message) {
  throw new Error(`Prime Wallet readiness verification failed: ${message}`);
}

async function cancelResponseBody(response) {
  await response.body?.cancel().catch(() => undefined);
}

async function readBoundedResponseBody(response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(declaredLength)) {
      await cancelResponseBody(response);
      fail("invalid content length");
    }
    if (Number(declaredLength) > MAX_RESPONSE_BYTES) {
      await cancelResponseBody(response);
      fail("response is oversized");
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("response is oversized");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("response body is not valid UTF-8");
  }
}

export async function verifyPrimeWalletReadiness(base, environment, buildSha, fetchImpl = fetch) {
  const origin = new URL(base);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    (origin.pathname !== "/" && origin.pathname !== "") ||
    origin.search ||
    origin.hash
  )
    fail("target must be one credential-free HTTPS origin");
  if (!ENVIRONMENTS.has(environment)) fail("expected environment must be SANDBOX or TEST");
  if (!SHA_PATTERN.test(buildSha))
    fail("expected build SHA must be 40 lowercase hexadecimal characters");

  const readinessUrl = new URL("/readyz", origin);
  const response = await fetchImpl(readinessUrl, {
    cache: "no-store",
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 200) {
    await cancelResponseBody(response);
    fail(`unexpected HTTP status ${response.status}`);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
    await cancelResponseBody(response);
    fail("response is not JSON");
  }
  const cacheDirectives = (response.headers.get("cache-control") ?? "")
    .split(",")
    .map((directive) => directive.trim().toLowerCase());
  if (!cacheDirectives.includes("no-store")) {
    await cancelResponseBody(response);
    fail("response is cacheable");
  }
  if (response.headers.get("x-content-type-options") !== "nosniff") {
    await cancelResponseBody(response);
    fail("response is missing nosniff");
  }

  const text = await readBoundedResponseBody(response);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail("response body is not valid JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    fail("response is not an object");
  if (Object.keys(payload).sort().join("\n") !== EXPECTED_KEYS.join("\n")) {
    fail("response field set drifted");
  }
  if (
    payload.status !== "ready" ||
    payload.service !== "fastlink-prime-wallet" ||
    payload.environment !== environment ||
    payload.buildSha !== buildSha ||
    payload.production !== false
  )
    fail("response identity does not match the deployed artifact");

  return { environment, buildSha, production: false, verified: true };
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const [base, environment, buildSha] = process.argv.slice(2);
  verifyPrimeWalletReadiness(base, environment, buildSha)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Prime Wallet readiness verification failed",
      );
      process.exitCode = 1;
    });
}
