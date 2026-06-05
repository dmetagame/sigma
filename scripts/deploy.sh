#!/usr/bin/env bash
# Sigma — two-phase deploy to Robinhood Chain testnet.
#
# Phase 1: cargo stylus deploy (Sigma Core, Rust WASM)
# Phase 2: forge script Deploy.s.sol (Vault + Strategist + Oracle)
#
# Requires .env.local at repo root with DEPLOYER_PRIVATE_KEY funded on RH testnet.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [[ ! -f .env.local ]]; then
  echo "✘ .env.local missing — copy .env.example and fill DEPLOYER_PRIVATE_KEY." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY not set in .env.local}"
: "${RH_TESTNET_RPC:=https://rpc.testnet.chain.robinhood.com}"

export PATH="/home/rouma/.foundry/bin:/home/rouma/.cargo/bin:$PATH"

phase=${1:-all}

if [[ "$phase" == "core" || "$phase" == "all" ]]; then
  echo "→ Phase 1: cargo stylus deploy (Sigma Core)"
  cd "$ROOT/core"
  out=$(cargo stylus deploy \
      --endpoint "$RH_TESTNET_RPC" \
      --private-key "$DEPLOYER_PRIVATE_KEY" \
      --no-verify 2>&1 | tee /tmp/sigma-core-deploy.log)
  addr=$(echo "$out" | grep -Eo "deployed code at address: 0x[a-fA-F0-9]{40}" | tail -1 | awk '{print $NF}')
  if [[ -z "$addr" ]]; then
    addr=$(echo "$out" | grep -Eo "contract activated and ready onchain with address: 0x[a-fA-F0-9]{40}" | tail -1 | awk '{print $NF}')
  fi
  if [[ -z "$addr" ]]; then
    echo "✘ Could not extract deployed address from cargo stylus deploy output." >&2
    echo "  Check /tmp/sigma-core-deploy.log and set SIGMA_CORE_ADDR manually." >&2
    exit 1
  fi
  echo "  Sigma Core deployed: $addr"
  # Update .env.local idempotently.
  if grep -q "^SIGMA_CORE_ADDR=" "$ROOT/.env.local"; then
    sed -i "s|^SIGMA_CORE_ADDR=.*|SIGMA_CORE_ADDR=$addr|" "$ROOT/.env.local"
  else
    echo "SIGMA_CORE_ADDR=$addr" >> "$ROOT/.env.local"
  fi
  export SIGMA_CORE_ADDR=$addr
fi

if [[ "$phase" == "solidity" || "$phase" == "all" ]]; then
  echo "→ Phase 2: forge script Deploy.s.sol"
  cd "$ROOT/contracts"
  : "${SIGMA_CORE_ADDR:?Set SIGMA_CORE_ADDR in .env.local first (or run with 'all')}"
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RH_TESTNET_RPC" \
    --broadcast \
    --slow \
    --skip-simulation \
    -vv

  jq -r '. | "\nDeployment summary:\n  SigmaCore:       \(.sigmaCore)\n  SigmaVault:      \(.sigmaVault)\n  SigmaStrategist: \(.sigmaStrategist)\n  OracleAdapter:   \(.oracleAdapter)\n  USDC:            \(.usdc)\n"' deployments/rh-testnet.json || cat deployments/rh-testnet.json

  echo "→ Syncing addresses into .env.local"
  vault=$(jq -r .sigmaVault deployments/rh-testnet.json)
  strat=$(jq -r .sigmaStrategist deployments/rh-testnet.json)
  usdc=$(jq -r .usdc deployments/rh-testnet.json)
  for kv in "SIGMA_VAULT_ADDR=$vault" "SIGMA_STRATEGIST_ADDR=$strat" "USDC_ADDR=$usdc"; do
    key="${kv%%=*}"
    if grep -q "^$key=" "$ROOT/.env.local"; then
      sed -i "s|^$key=.*|$kv|" "$ROOT/.env.local"
    else
      echo "$kv" >> "$ROOT/.env.local"
    fi
  done
fi

echo "✓ Done."
