# Sigma

On-chain risk engine in Stylus for tokenized equity collateral on Robinhood Chain.

Live app: https://sigma-two-iota.vercel.app

**Hackathon entry — Arbitrum Open House London Online Buildathon (Jun 14, 2026).**

## What it does

Tokenized stocks need portfolio-aware collateral controls before they can support responsible on-chain credit. Sigma computes parametric portfolio VaR in Stylus (Rust/WASM), applies it inside a Solidity vault, and exposes policy-bound actions to an AI risk agent.

The current Robinhood Chain testnet deployment is a hackathon prototype. Stock prices are published by a dedicated reporter only after Pyth and RedStone agree within 2%; volatilities, correlations, and the off-chain market-regime signal remain illustrative model inputs.

## Architecture

| Layer | Stack | Role |
|---|---|---|
| Sigma Core | Stylus (Rust) | On-chain `compute_portfolio_var()` — fixed-point math, gas-optimized via WASM |
| Sigma Vault | Solidity | Non-custodial collateral vault: tokenized stocks + USDC, dynamic LTV from Core |
| Sigma Strategist | Solidity | Agent-bound policy executor with on-chain guardrails |
| Sigma Pilot | TypeScript / AI SDK | Gemini agent: demo regime signal → policy-bound action |
| Sigma Web | Next.js 16 | Dashboard: portfolio, risk model, deployment proof, decision log |

All on **Robinhood Chain testnet** (chain ID 46630). Stylus support was verified via `cargo stylus check` against `https://rpc.testnet.chain.robinhood.com` on 2026-06-05.

## Security status

- Liquidations are value-bounded to repayment plus a 5% incentive and limited to a 50% close factor.
- An 80% base-LTV ceiling backs up the dynamic VaR limit.
- Asset decimals, volatility, correlations, and global risk parameters are validated, and per-stock volatility is owner-updatable (`setVol`) so risk inputs can track regime changes without a redeploy.
- The agent can attempt at most one mutating action per tick and reads policy/cooldown/repayment capacity first.
- The oracle enforces timestamp monotonicity, freshness, sequential-deviation limits, and owner-controlled emergency pause.
- GitHub Actions hosts the 30-minute oracle updater and a six-hour defensive guardian that can only repay unhealthy positions. Full demo-agent actions require manual dispatch.
- Dry and live workflow paths were successfully exercised on 2026-06-07; receipt links are recorded in the deployment evidence.
- This code has not received an independent professional audit and is not suitable for mainnet funds.
- The hardened Solidity deployment below was broadcast and seeded on 2026-06-11 after a second maintainer audit ([`docs/AUDIT-2026-06-10.md`](docs/AUDIT-2026-06-10.md)). Earlier Vault and Strategist addresses are legacy demo contracts and should not be used.

### Hardened deployment

| Contract | Robinhood Chain testnet address |
|---|---|
| Sigma Core (Stylus) | `0x3517b74800E6A731656D8cc809d77f730da4d1dA` |
| Sigma Vault | `0x077292Dbc17214719d09FAcFA58915F48525E0AF` |
| Sigma Strategist | `0x652C206Add1418a09C34e7be311611D79a422B78` |
| Oracle Adapter | `0x49E038450866157b3B0f790992690EcE842602E0` |
| Solidity benchmark core | `0x3f64d310B88f8c89aFd70ccCD33094DF7e7c3a91` |

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
cd contracts && forge test           # 40 passing
cd ../core   && cargo test --release # 3 passing
```

### Deploy to Robinhood Chain testnet

```bash
cp .env.example .env.local           # fill deployer, funded reporter, Pilot, and Google AI key
./scripts/deploy.sh                  # phase 1 (Stylus) + phase 2 (Solidity)
./scripts/seed-demo.sh               # fund and create the public testnet demo
pnpm verify:deployment               # read-only on-chain smoke test
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

## Owner powers (testnet disclosure)

The current owner of every contract is the testnet deployer EOA. Concretely it can: update per-stock volatilities and pairwise correlations, change the VaR z-score/horizon/safety factor and the max-LTV cap, swap the Sigma Core and oracle adapter addresses, and add stocks. The oracle owner can rotate the reporter, tune staleness/deviation limits, and pause reads. The owner **cannot** write prices directly — only the reporter can, through the cross-check pipeline. Production would put all of this behind a multisig + timelock, with parameter-change events monitored by alerting and a decentralized reporter set.

## Known prototype limits

- The vault is a funded credit demo, not a complete lending market: there are no lender shares, interest accrual, reserves, or bad-debt socialization.
- The testnet oracle reporter is centralized even though it cross-checks two independent sources. Production requires on-chain verified feeds, monitoring, and multisig/timelock governance.
- Pausing the oracle also freezes liquidations and withdrawals for indebted users, since every health check reads prices. A production design needs per-asset circuit breakers with a grace-period unwind instead of a global read freeze.
- If price moves more than the oracle's sequential-deviation limit between publishes (e.g. after a reporter outage), updates revert until the owner temporarily raises the limit (hard-capped at 50%) and the reporter publishes staged steps back to market. A gap larger than 50% is unrecoverable by design, because the owner cannot write prices directly.
- The two deviation gates are intentionally different: the **2% off-chain gate** requires Pyth and RedStone to agree on the *same observation* before the reporter signs anything, while the **25% on-chain gate** is a sequential circuit breaker limiting how far any *new publish* may move from the stored price — wide enough to absorb overnight gaps and stale-period catch-ups without owner intervention.
- `maxBorrowable()` is the risk ceiling from VaR and the LTV cap; an actual borrow is additionally bounded by the vault's USDC balance. The app displays both and clamps borrow submissions to the smaller value.
- VaR is a model input, not a guarantee against jumps, liquidity gaps, or non-normal returns.
- The web app exposes wallet-driven deposit, withdrawal, borrow, repayment, and Pilot policy controls. The defensive repayment guardian is scheduled in GitHub Actions; leverage-changing demo-agent actions still require manual dispatch.
- At block `70915096`, the deployed five-asset benchmark measured 122,318 gas for Stylus and 128,960 for Solidity, a 5.15% saving. It is one workload, not a universal multiplier.

Deployment receipts and demo-state evidence are recorded in [`docs/DEPLOYMENT-2026-06-11.md`](docs/DEPLOYMENT-2026-06-11.md) (migration) and [`docs/DEPLOYMENT-2026-06-07.md`](docs/DEPLOYMENT-2026-06-07.md) (prior hardened deployment).
The maintainer security review and external-audit handoff are in [`docs/SECURITY-REVIEW-2026-06-07.md`](docs/SECURITY-REVIEW-2026-06-07.md) and [`docs/INDEPENDENT-AUDIT-SCOPE.md`](docs/INDEPENDENT-AUDIT-SCOPE.md).

## Robinhood Chain testnet

| | |
|---|---|
| Chain ID | 46630 |
| RPC | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://explorer.testnet.chain.robinhood.com |
| Faucet | https://faucet.testnet.chain.robinhood.com |
| Gas token | ETH |
