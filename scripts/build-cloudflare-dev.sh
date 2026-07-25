#!/usr/bin/env bash
set -euo pipefail

bun install --frozen-lockfile
bun run audit:production
bun run build

test -s .output/server/index.mjs
test -d .output/public
