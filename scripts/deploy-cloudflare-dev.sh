#!/usr/bin/env bash
set -euo pipefail
set +x

config="wrangler.dev.jsonc"
worker="fastlink-prime-wallet-dev"

if [[ ! -f "$config" ]]; then
  echo "BLOCKED: $config not found" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "BLOCKED: CLOUDFLARE_API_TOKEN is required" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "BLOCKED: CLOUDFLARE_ACCOUNT_ID is required" >&2
  exit 1
fi

echo "Deploying $worker with Wrangler CLI (api-token)"
auth_output="$(npx --yes wrangler@4.114.0 whoami 2>&1)" || {
  echo "BLOCKED: Cloudflare API Token authentication failed" >&2
  exit 1
}
if grep -qi "not authenticated" <<<"$auth_output"; then
  echo "BLOCKED: Cloudflare API Token authentication failed" >&2
  exit 1
fi
export VITE_FASTLINK_API_URL="${VITE_FASTLINK_API_URL:-/api}"
export VITE_FASTLINK_ENVIRONMENT="${VITE_FASTLINK_ENVIRONMENT:-SANDBOX}"
export VITE_FASTLINK_BUILD_SHA="${VITE_FASTLINK_BUILD_SHA:-$(git rev-parse HEAD 2>/dev/null || printf unknown)}"
bash scripts/build-cloudflare-dev.sh

deploy_log="$(mktemp)"
trap 'rm -f "$deploy_log"' EXIT
npx --yes wrangler@4.114.0 deploy --config "$config" 2>&1 | tee "$deploy_log"

deploy_url="$(grep -Eo 'https://[A-Za-z0-9._-]+\.workers\.dev' "$deploy_log" | tail -n 1 || true)"
if [[ -z "$deploy_url" ]]; then
  echo "BLOCKED: Wrangler did not return a workers.dev URL" >&2
  exit 1
fi

curl --fail --silent --show-error --location --max-time 30 "$deploy_url/" >/dev/null
echo "DEPLOYED_URL=$deploy_url"
echo "DEPLOYED_WORKER=$worker"
echo "DEPLOYED_SHA=$(git rev-parse HEAD 2>/dev/null || printf unknown)"
