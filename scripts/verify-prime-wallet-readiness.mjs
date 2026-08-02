import { pathToFileURL } from "node:url";

const ENVIRONMENTS = new Set(["SANDBOX", "TEST"]);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const EXPECTED_KEYS = ["buildSha", "environment", "service", "status"];

function fail(message) {
  throw new Error(`Prime Wallet readiness verification failed: ${message}`);
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
  if (response.status !== 200) fail(`unexpected HTTP status ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").startsWith("application/json")) {
    fail("response is not JSON");
  }
  if (!(response.headers.get("cache-control") ?? "").includes("no-store")) {
    fail("response is cacheable");
  }
  if (response.headers.get("x-content-type-options") !== "nosniff") {
    fail("response is missing nosniff");
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1_024) fail("response is oversized");
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
    payload.buildSha !== buildSha
  )
    fail("response identity does not match the deployed artifact");

  return { environment, buildSha, verified: true };
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
