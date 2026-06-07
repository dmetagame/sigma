# Sigma

On-chain risk engine in Stylus for tokenized equity collateral on Robinhood Chain.

**Hackathon entry — Arbitrum Open House London Online Buildathon (Jun 14, 2026).**

## What it does

Tokenized stocks need portfolio-aware collateral controls before they can support responsible on-chain credit. Sigma computes parametric portfolio VaR in Stylus (Rust/WASM), applies it inside a Solidity vault, and exposes policy-bound actions to an AI risk agent.

The current Robinhood Chain testnet deployment is a hackathon prototype. Its stock prices, volatilities, correlations, and off-chain market-regime signal are seeded demo inputs. The contracts and UI identify those assumptions rather than presenting them as production market data.

## Architecture

| Layer | Stack | Role |
|---|---|---|
| Sigma Core | Stylus (Rust) | On-chain `compute_portfolio_var()` — fixed-point math, gas-optimized via WASM |
| Sigma Vault | Solidity | Non-custodial collateral vault: tokenized stocks + USDC, dynamic LTV from Core |
| Sigma Strategist | Solidity | Agent-bound policy executor with on-chain guardrails |
| Sigma Pilot | TypeScript / AI SDK | Gemini or Claude agent: demo regime signal → policy-bound action |
| Sigma Web | Next.js 16 | Dashboard: portfolio, risk model, deployment proof, decision log |

All on **Robinhood Chain testnet** (chain ID 46630). Stylus support was verified via `cargo stylus check` against `https://rpc.testnet.chain.robinhood.com` on 2026-06-05.

## Security status

- Liquidations are value-bounded to repayment plus a 5% incentive and limited to a 50% close factor.
- An 80% base-LTV ceiling backs up the dynamic VaR limit.
- Asset decimals, volatility, correlations, and global risk parameters are validated.
- The agent can attempt at most one mutating action per tick and reads policy/cooldown/repayment capacity first.
- This code has not received an independent professional audit and is not suitable for mainnet funds.
- The public deployment listed below predates the 2026-06-06 hardening changes and must be redeployed before it is treated as the secured build.

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
cd contracts && forge test           # 22 passing
cd ../core   && cargo test --release # 3 passing
```

### Deploy to Robinhood Chain testnet

```bash
cp .env.example .env.local           # fill deployer, Pilot, and one supported LLM API key
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

## Known prototype limits

- The vault is a funded credit demo, not a complete lending market: there are no lender shares, interest accrual, reserves, or bad-debt socialization.
- The fallback oracle is owner-controlled. Production deployment requires live feeds, staleness limits, and an emergency process governed by a multisig/timelock.
- VaR is a model input, not a guarantee against jumps, liquidity gaps, or non-normal returns.
- The Pilot runs from a CLI; continuous automation and user transaction flows are not yet hosted in the web app.
- A reproducible Solidity-versus-Stylus gas benchmark is still pending. No gas-reduction multiplier is claimed.

## Robinhood Chain testnet

| | |
|---|---|
| Chain ID | 46630 |
| RPC | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Faucet | https://faucet.testnet.chain.robinhood.com |
| Gas token | ETH |
