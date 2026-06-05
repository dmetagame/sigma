# Sigma Architecture

## Layers

```
┌────────────────────────────────────────────────────────────┐
│              Sigma Web (Next.js 16 / Vercel)               │
│  Portfolio · Risk panel · Gas comparison · Decision log    │
└─────────────────────────┬──────────────────────────────────┘
                          │ Wagmi / Viem
┌─────────────────────────┴──────────────────────────────────┐
│         Sigma Pilot (TS, AI SDK, Claude)                   │
│  Tools: getRiskMetrics · proposeRebalance · executeAction  │
└─────────────────────────┬──────────────────────────────────┘
                          │ signed tx
┌─────────────────────────┴──────────────────────────────────┐
│       Sigma Strategist (Solidity, Robinhood Chain)         │
│  Policy guardrails · agent-bound execution path            │
└────┬──────────────────────────────────┬─────────────────────┘
     │ borrow / liquidate              │ read risk
     ▼                                  ▼
┌────────────────────┐  ┌─────────────────────────────────────┐
│  Sigma Vault       │  │  Sigma Core (Stylus, RH Chain)      │
│  Stocks + USDC     │──▶  compute_portfolio_var()            │
│  Dynamic LTV       │  │  fixed-point Q64.64 · WASM-fast     │
└────────────────────┘  └─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  MockRHStock (RH-AAPL, RH-TSLA, RH-NVDA) + OracleAdapter    │
│  (Stand-in until RH testnet stock token addresses found)    │
└─────────────────────────────────────────────────────────────┘
```

## Why this wins

- **Smart contract quality** — Stylus implementation of VaR with fixed-point math, Foundry test suite, policy-bound executor pattern.
- **PMF** — tokenized stocks need risk pricing to be useful as DeFi collateral; this is what unlocks institutional capital on Robinhood Chain.
- **Innovation** — first on-chain portfolio risk engine in Stylus; the Bengaluru Open House winner used the same pattern for AMM invariants — we apply it to risk.
- **Real problem-solving** — Robinhood Chain creates supply (tokenized equities); Sigma creates demand-side composability so they can be collateral.

## Risk decisions made on Day 1

1. **Single-chain (RH testnet) — not multi-chain.** Verified Stylus is enabled on RH Chain via `cargo stylus check` even though their docs only document Solidity/Foundry. Skips relayer complexity.
2. **One Stylus function only** — `compute_portfolio_var()`. Margin/Black-Scholes stay in Solidity. Compresses Rust scope to ~6h.
3. **Mock RH stock tokens by default.** Replace with real testnet stock token addresses once discovered.
4. **Oracle adapter pattern.** Pluggable: Chainlink (RH partner) when feeds available; manipulable mock for demo stress-test.

## Stylus support on RH Chain — verification log

```
$ cargo stylus check --endpoint https://rpc.testnet.chain.robinhood.com
contract size: 5.9 KB (5908 bytes)
wasm data fee: 0.000071 ETH (originally 0.000059 ETH with 20% bump)
```

The RPC successfully estimated a WASM activation cost. This is only possible when ArbOS has Stylus enabled. Confirmed 2026-06-05.
