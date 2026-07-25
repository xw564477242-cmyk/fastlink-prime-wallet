#!/usr/bin/env bash
set -euo pipefail
set +x

config="wrangler.dev.jsonc"
worker="fastlink-prime-wallet-dev"

if [[ ! -f "$config" ]]; then
  echo "BLOCKED: $config not found" >&2
  exit 1
fi

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    echo "BLOCKED: CLOUDFLARE_ACCOUNT_ID is required with CLOUDFLARE_API_TOKEN" >&2
    exit 1
  fi
  auth_mode="api-token"
else
  auth_mode="wrangler-profile"
fi

echo "Deploying $worker with Wrangler CLI ($auth_mode)"
npx --yes wrangler@4.114.0 whoami >/dev/null
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
