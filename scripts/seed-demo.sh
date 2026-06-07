#!/usr/bin/env bash
# Seed a fresh Robinhood Chain testnet deployment with the public demo position.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [[ ! -f .env.local ]]; then
  echo "x .env.local missing" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY not set}"
: "${PILOT_PRIVATE_KEY:?PILOT_PRIVATE_KEY not set}"
: "${SIGMA_VAULT_ADDR:?SIGMA_VAULT_ADDR not set}"
: "${SIGMA_STRATEGIST_ADDR:?SIGMA_STRATEGIST_ADDR not set}"
: "${RH_TESTNET_RPC:=https://rpc.testnet.chain.robinhood.com}"

cd "$ROOT/contracts"
forge script script/SeedDemo.s.sol:SeedDemo \
  --rpc-url "$RH_TESTNET_RPC" \
  --broadcast \
  --slow \
  --skip-simulation \
  -vv

user=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
borrow_data=$(cast abi-encode "f(uint256)" 50000000)
rationale="Demo borrow: 50 USDC after portfolio VaR and the 80% base-LTV check"

cast send \
  --rpc-url "$RH_TESTNET_RPC" \
  --private-key "$PILOT_PRIVATE_KEY" \
  --gas-limit 2000000 \
  "$SIGMA_STRATEGIST_ADDR" \
  "executeAction(address,uint8,bytes,string)" \
  "$user" 0 "$borrow_data" "$rationale"

echo "Demo seeded."
printf '  Portfolio value: %s\n' "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'portfolioValue(address)(uint256)' "$user")"
printf '  Debt:            %s\n' "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'debt(address)(uint256)' "$user")"
printf '  VaR:             %s\n' "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'computeVaR(address)(uint256)' "$user")"
printf '  Max borrowable:  %s\n' "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'maxBorrowable(address)(uint256)' "$user")"
printf '  Health:          %s\n' "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'health(address)(uint256)' "$user")"
