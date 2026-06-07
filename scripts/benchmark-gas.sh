#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

RPC_URL="${RH_TESTNET_RPC:-https://rpc.testnet.chain.robinhood.com}"
STYLUS="${SIGMA_CORE_ADDR:?SIGMA_CORE_ADDR is required}"
SOLIDITY="${SOLIDITY_BENCHMARK_ADDR:?SOLIDITY_BENCHMARK_ADDR is required}"
BLOCK_NUMBER="${BENCHMARK_BLOCK:-$(cast block-number --rpc-url "$RPC_URL")}"

WEIGHTS='[200000000000000000,200000000000000000,200000000000000000,200000000000000000,200000000000000000]'
VOLS='[450000000000000000,500000000000000000,320000000000000000,400000000000000000,650000000000000000]'
CORR='[1000000000000000000,550000000000000000,400000000000000000,350000000000000000,600000000000000000,1000000000000000000,500000000000000000,450000000000000000,550000000000000000,1000000000000000000,550000000000000000,400000000000000000,1000000000000000000,400000000000000000,1000000000000000000]'
PORTFOLIO_VALUE=1000000000000
Z_SCORE=1645000000000000000
HORIZON=62994079237678000
SIGNATURE='computePortfolioVar(uint256[],uint256[],int256[],uint256,uint256,uint256)(uint256)'

estimate() {
  cast estimate --rpc-url "$RPC_URL" --block "$BLOCK_NUMBER" "$1" "$SIGNATURE" \
    "$WEIGHTS" "$VOLS" "$CORR" "$PORTFOLIO_VALUE" "$Z_SCORE" "$HORIZON"
}

stylus_gas="$(estimate "$STYLUS")"
solidity_gas="$(estimate "$SOLIDITY")"
stylus_result="$(cast call --rpc-url "$RPC_URL" --block "$BLOCK_NUMBER" "$STYLUS" "$SIGNATURE" \
  "$WEIGHTS" "$VOLS" "$CORR" "$PORTFOLIO_VALUE" "$Z_SCORE" "$HORIZON")"
solidity_result="$(cast call --rpc-url "$RPC_URL" --block "$BLOCK_NUMBER" "$SOLIDITY" "$SIGNATURE" \
  "$WEIGHTS" "$VOLS" "$CORR" "$PORTFOLIO_VALUE" "$Z_SCORE" "$HORIZON")"

# cast annotates large decoded integers (for example, "123 [1.23e2]").
stylus_gas="${stylus_gas%% *}"
solidity_gas="${solidity_gas%% *}"
stylus_result="${stylus_result%% *}"
solidity_result="${solidity_result%% *}"

if [[ "$stylus_result" != "$solidity_result" ]]; then
  printf 'result mismatch: stylus=%s solidity=%s\n' "$stylus_result" "$solidity_result" >&2
  exit 1
fi

node -e '
  const [block, stylus, solidity, result] = process.argv.slice(1).map(BigInt);
  const saving = Number((solidity - stylus) * 10000n / solidity) / 100;
  console.log(JSON.stringify({
    vector: "five-asset equal-weight portfolio",
    blockNumber: block.toString(),
    stylusGas: stylus.toString(),
    solidityGas: solidity.toString(),
    gasSavingPercent: saving,
    resultUsdc6: result.toString()
  }, null, 2));
' "$BLOCK_NUMBER" "$stylus_gas" "$solidity_gas" "$stylus_result"
