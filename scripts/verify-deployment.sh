#!/usr/bin/env bash
# Read-only smoke test for the configured Robinhood Chain testnet deployment.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "x .env.local missing" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY not set}"
: "${RH_TESTNET_RPC:?RH_TESTNET_RPC not set}"
: "${SIGMA_CORE_ADDR:?SIGMA_CORE_ADDR not set}"
: "${SIGMA_VAULT_ADDR:?SIGMA_VAULT_ADDR not set}"
: "${SIGMA_STRATEGIST_ADDR:?SIGMA_STRATEGIST_ADDR not set}"
: "${ORACLE_ADAPTER_ADDR:?ORACLE_ADAPTER_ADDR not set}"
: "${USDC_ADDR:?USDC_ADDR not set}"
: "${STOCK_TSLA_ADDR:?STOCK_TSLA_ADDR not set}"

user=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")

first_word() {
  awk '{print $1}'
}

address_word() {
  first_word | tr 'A-F' 'a-f'
}

assert_eq() {
  local label=$1 actual=$2 expected=$3
  if [[ "$actual" != "$expected" ]]; then
    printf 'x %s: expected %s, got %s\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
  printf 'ok %s: %s\n' "$label" "$actual"
}

assert_ge() {
  local label=$1 actual=$2 expected=$3
  if ! node -e 'process.exit(BigInt(process.argv[1]) >= BigInt(process.argv[2]) ? 0 : 1)' "$actual" "$expected"; then
    printf 'x %s: expected >= %s, got %s\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
  printf 'ok %s: %s\n' "$label" "$actual"
}

for address in "$SIGMA_CORE_ADDR" "$SIGMA_VAULT_ADDR" "$SIGMA_STRATEGIST_ADDR" "$ORACLE_ADAPTER_ADDR"; do
  code=$(cast code --rpc-url "$RH_TESTNET_RPC" "$address")
  if [[ "$code" == "0x" ]]; then
    echo "x no code at $address" >&2
    exit 1
  fi
done
echo "ok contract code present"

assert_eq "vault core" \
  "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'sigmaCore()(address)' | address_word)" \
  "${SIGMA_CORE_ADDR,,}"
assert_eq "vault strategist executor" \
  "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'executor(address)(address)' "$user" | address_word)" \
  "${SIGMA_STRATEGIST_ADDR,,}"
assert_eq "vault oracle" \
  "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'oracle()(address)' | address_word)" \
  "${ORACLE_ADAPTER_ADDR,,}"
assert_eq "max LTV" \
  "$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'maxLtvWad()(uint256)' | first_word)" \
  "800000000000000000"
portfolio_value="$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'portfolioValue(address)(uint256)' "$user" | first_word)"
assert_ge "portfolio value" "$portfolio_value" "1"
debt="$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'debt(address)(uint256)' "$user" | first_word)"
assert_ge "debt" "$debt" "0"
max_borrowable="$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'maxBorrowable(address)(uint256)' "$user" | first_word)"
assert_ge "max borrowable" "$max_borrowable" "$debt"
health="$(cast call --rpc-url "$RH_TESTNET_RPC" "$SIGMA_VAULT_ADDR" 'health(address)(uint256)' "$user" | first_word)"
assert_ge "health factor" "$health" "1000000000000000000"
tsla_price="$(cast call --rpc-url "$RH_TESTNET_RPC" "$ORACLE_ADAPTER_ADDR" 'getPrice(address)(uint256)' "$STOCK_TSLA_ADDR" | first_word)"
assert_ge "fresh TSLA oracle price" "$tsla_price" "1"
vault_liquidity="$(cast call --rpc-url "$RH_TESTNET_RPC" "$USDC_ADDR" 'balanceOf(address)(uint256)' "$SIGMA_VAULT_ADDR" | first_word)"
assert_ge "vault liquidity" "$vault_liquidity" "1"

zero_selector=$(cast sig "ZeroAmount()")
set +e
liquidation_error=$(cast call \
  --rpc-url "$RH_TESTNET_RPC" \
  --from "$user" \
  "$SIGMA_VAULT_ADDR" \
  'liquidate(address,address,uint256,uint256)' \
  "$user" "$STOCK_TSLA_ADDR" 1000000000000000000 0 2>&1)
liquidation_status=$?
set -e
if [[ $liquidation_status -eq 0 || "$liquidation_error" != *"$zero_selector"* ]]; then
  echo "x zero-repayment liquidation did not revert with ZeroAmount" >&2
  echo "$liquidation_error" >&2
  exit 1
fi
echo "ok zero-repayment liquidation rejected"

echo "Deployment verification passed."
