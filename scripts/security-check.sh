#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(
  cd "$ROOT/contracts"
  forge fmt --check
  forge test -vv
  slither . \
    --filter-paths 'lib|test|script' \
    --exclude-dependencies \
    --exclude arbitrary-send-erc20,calls-loop,cyclomatic-complexity,timestamp,unused-return
)

(
  cd "$ROOT/core"
  cargo fmt --check
  cargo test
  cargo clippy -- -D warnings
)

pnpm --dir "$ROOT" --filter @sigma/agent test
pnpm --dir "$ROOT" --filter @sigma/agent build
pnpm --dir "$ROOT" --filter @sigma/web exec tsc --noEmit
pnpm --dir "$ROOT" --filter @sigma/web build
pnpm --dir "$ROOT" audit --prod
