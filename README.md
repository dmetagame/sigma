# Sigma

On-chain risk engine in Stylus for tokenized equity collateral on Robinhood Chain.

**Hackathon entry — Arbitrum Open House London Online Buildathon (Jun 14, 2026).**

## What it does

Tokenized stocks can't become useful DeFi collateral until somebody builds real risk pricing on-chain. Sigma does it in Stylus (Rust WASM), making portfolio risk math ~40× cheaper than the Solidity equivalent, and exposes the result to an AI agent that manages a collateralized vault on user-defined policy.

## Architecture

| Layer | Stack | Role |
|---|---|---|
| Sigma Core | Stylus (Rust) | On-chain `compute_portfolio_var()` — fixed-point math, gas-optimized via WASM |
| Sigma Vault | Solidity | Non-custodial collateral vault: tokenized stocks + USDC, dynamic LTV from Core |
| Sigma Strategist | Solidity | Agent-bound policy executor with on-chain guardrails |
| Sigma Pilot | TypeScript / AI SDK | Claude agent: market regime signals → policy-bound proposed actions |
| Sigma Web | Next.js 16 | Dashboard: portfolio, risk panel, gas comparison, decision log |

All on **Robinhood Chain testnet** (chain ID 46630). Stylus support verified via `cargo stylus check` against `https://rpc.testnet.chain.robinhood.com` on 2026-06-05 — even though no Robinhood docs publicly confirm it.

## Repository layout

```
sigma/
├── core/        # Stylus crate — risk math
├── contracts/   # Foundry — Vault, Strategist, MockStock, RiskAdapter
├── agent/       # TypeScript — Pilot AI agent
├── web/         # Next.js 16 — dashboard
└── docs/        # design notes
```

## Quickstart

```bash
pnpm install
cd core && cargo stylus check --endpoint https://rpc.testnet.chain.robinhood.com
cd ../contracts && forge build
cd ../web && pnpm dev
```

## Robinhood Chain testnet

| | |
|---|---|
| Chain ID | 46630 |
| RPC | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Faucet | https://faucet.testnet.chain.robinhood.com |
| Gas token | ETH |
