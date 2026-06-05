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
cd contracts && forge test           # 12 passing
cd ../core   && cargo test --release # 3 passing
```

### Deploy to Robinhood Chain testnet

```bash
cp .env.example .env.local           # fill DEPLOYER_PRIVATE_KEY, ANTHROPIC_API_KEY, PILOT_PRIVATE_KEY
./scripts/deploy.sh                  # phase 1 (Stylus) + phase 2 (Solidity)
```

The deploy script auto-discovers real Robinhood Chain testnet token addresses:

| Asset | Address |
|---|---|
| USDC | `0xAc80194dc1aE8eF52df73e7e1864fB3C62290fe0` (6-dec) |
| TSLA | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` |
| AMD  | `0x71178BAc73cBeb415514eB542a8995b82669778d` |
| AMZN | `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02` |
| NFLX | `0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93` |
| PLTR | `0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0` |

Get them from `https://faucet.testnet.chain.robinhood.com` (drips ETH + 5 of each stock per request). USDC isn't dripped — borrow some against the stocks via the **Aave Stock** fork that's already live on RH testnet.

## Robinhood Chain testnet

| | |
|---|---|
| Chain ID | 46630 |
| RPC | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Faucet | https://faucet.testnet.chain.robinhood.com |
| Gas token | ETH |
