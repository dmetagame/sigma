# Sigma — HackQuest submission copy

For the **Arbitrum Open House London · Online Buildathon** (Robinhood Chain Reserved Slot + Best Agentic Project tracks).

---

## Elevator (one sentence)

Sigma is an on-chain portfolio risk engine — written in Stylus, verified against a Solidity baseline, and wired into a vault that lets tokenized equities behave as composable DeFi collateral on Robinhood Chain.

---

## Short description (≈150 words, for card preview)

Tokenized stocks cannot become useful DeFi collateral until somebody builds real risk pricing on-chain. Sigma does it. A parametric portfolio VaR engine runs in Stylus (Rust, WASM), is byte-equivalent to a Solidity baseline deployed at the same address space for verification, and is called by the Sigma Vault during every borrow and withdrawal check. A non-custodial Vault accepts the five live Robinhood Chain stock tokens (TSLA, AMD, AMZN, NFLX, PLTR), borrows real testnet USDC against the basket, and bounds leverage with a correlation-aware VaR plus an independent 80% base-LTV ceiling. A separate Strategist contract enforces user-signed policies before any AI-agent proposal touches the position; every successful action emits a rationale string on-chain. Built for the Robinhood Chain reserved slot and the Best Agentic Project track.

---

## Full submission body

### The unlock

Robinhood Chain creates a new asset class on-chain: tokenized US equities (TSLA, AMD, AMZN, NFLX, PLTR are live on testnet). The killer use case is **using those equities as DeFi collateral** — that is what turns a passive tokenization layer into an active financial network and what attracts the institutional capital the chain is positioned for.

But equity collateral without portfolio-level risk pricing is just a worse version of an over-collateralized stablecoin loan. It ignores correlation, vol regimes, and concentration. Sigma is the missing risk layer: real on-chain portfolio VaR, cheap enough to compute on every state-changing call.

### What we shipped (verifiable, not vibes)

**Sigma Core — Stylus VaR engine**
- Single-factor parametric portfolio VaR in Rust, compiled to WASM, activated on Robinhood Chain.
- `compute_portfolio_var(weights[], vols[], corrPacked[], value, z, sqrtT) → VaR`
- Fixed-point WAD math; signed I256 for negative correlations; Babylonian sqrt; packed upper-triangular correlation matrix.
- Live address: `0x3517b74800E6A731656D8cc809d77f730da4d1dA`.

**Solidity baseline + cross-language proof**
- An equivalently-spec'd Solidity implementation `SoliditySigmaCore` is deployed at `0x3f64d310B88f8c89aFd70ccCD33094DF7e7c3a91`.
- Both cores return `37,014,966,203` USDC-6 units on the same five-asset vector.
- Measured at Robinhood Chain block 70,915,096: Stylus **122,318 gas** vs Solidity **128,960 gas** — a **5.15% saving** for this workload, with cross-language correctness proven. Reproducible with `npm run benchmark:gas`.

**Sigma Vault — collateralized lending against tokenized equities**
- Non-custodial. Five live stocks supported. Borrows real testnet USDC (`0xAc80…0fe0`).
- Borrow ceiling = min(`portfolio_value − safety·VaR`, 80%·`portfolio_value`). The base-LTV cap is a hard backstop against any oracle/VaR understatement.
- Live address: `0x077292Dbc17214719d09FAcFA58915F48525E0AF`.

**Sigma Strategist — agent-bound policy executor**
- Per-user `Policy` struct: `agent`, `maxBorrow`, `maxStockShare`, `minHealthFactor`, `cooldownSec`, `active`.
- Off-chain Pilot signs proposals; Strategist validates against policy + simulates against Vault before forwarding.
- Repayment is treated as strictly risk-reducing — bypasses cooldown and non-worsening postconditions so deleveraging is never blocked.
- Every successful action emits `ActionExecuted(user, agent, type, data, rationale)` — the chain is the audit log.
- Live address: `0x652C206Add1418a09C34e7be311611D79a422B78`.

**Cross-checked Oracle Adapter**
- A dedicated reporter publishes prices only after independent Pyth + RedStone agreement within 200 bps off-chain.
- On-chain enforces freshness, monotonic timestamps, sequential-deviation limits, separated owner-vs-reporter roles, emergency pause.
- Live address: `0x49E038450866157b3B0f790992690EcE842602E0`. Active reporter: `0x100AE3d90A47363d229EdB1268BD296445e0340D`.

**Sigma Pilot — Gemini 2.5 Flash agent**
- Tool-using agent reads on-chain state (`getPortfolioState`, `getMarketRegime`) and proposes exactly one of `Borrow / Repay / Withdraw` per tick, with a free-form rationale recorded on-chain.
- Provider-agnostic (Gemini or Claude via `PILOT_PROVIDER`). Defaults to free Gemini quota for reproducibility.

**Scheduled automation — defensive guardian, not full agent**
- `.github/workflows/pilot.yml` runs **a deterministic repay-only guardian every 6 hours**, not the full LLM agent. It will only submit a transaction when health is below the user's policy minimum and the user has USDC + Strategist allowance to repay. Full demo-agent actions require explicit manual workflow dispatch.
- `.github/workflows/oracle-update.yml` runs the cross-checked publisher every 30 minutes.

### How it addresses the four judging criteria

**Smart contract quality**
- 40 Foundry tests including 512 fuzz runs across two Vault safety invariants (liquidation never seizes above the configured bonus; successful borrow always leaves the position healthy).
- Slither static analysis: 0 findings after remediation, with each excluded detector class documented in `SECURITY-REVIEW-2026-06-07.md`.
- Cross-language numerical equivalence proven (Stylus and Solidity cores produce identical VaR for the deployed reference vector).
- CI runs against a Foundry binary pinned by SHA-256.
- Hardened during review: liquidation no-repay attack closed, repayment over-pull closed, base-LTV ceiling added, oracle staleness enforced, Strategist cooldown can no longer block emergency repay, concentration math upgraded to full-precision `mulDiv`.

**Product-Market Fit**
- Tokenized equity holders on Robinhood Chain are the immediate TAM — every additional stock-token holder is potential Sigma collateral.
- Aave Stock fork is already deployed on the chain and uses static per-asset LTVs from governance. Sigma's differentiator is **dynamic per-portfolio LTV** that reflects actual correlation and vol — capital-efficiency for sophisticated users.
- Composes with the chain instead of competing with it: stock tokens are real, USDC is real, oracle sources are Pyth and RedStone.

**Innovation and Creativity**
- First on-chain portfolio risk engine in Stylus, with both implementations deployed side-by-side so the gas comparison is reproducible rather than asserted.
- Decision-receipt pattern: every agent action carries a free-form rationale string that ends up in `ActionExecuted` log topics on chain — auditable without an off-chain database.
- Scheduled defensive guardian replaces the more obvious "always-on LLM agent" pattern — keeps the AI angle without making automated leverage decisions on a mock signal.

**Real Problem Solving**
- The chain explicitly exists to bring real-world assets on-chain. The bottleneck for composing those assets into DeFi is risk pricing, not minting them. Sigma supplies the missing layer.
- All artifacts are testnet-honest: no real-money risk surface is implied. Open questions (no interest accrual, no multisig, illustrative correlations, no professional audit) are listed in `docs/AUDIT-2026-06-06.md` and `docs/INDEPENDENT-AUDIT-SCOPE.md`.

### Tracks

- **Robinhood Chain reserved slot** — Sigma is the user-facing product on Robinhood Chain (Vault + Strategist + Oracle live on chain id 46630).
- **Best Agentic Project** — Pilot is a Gemini-driven tool-using agent that reads on-chain VaR, reasons about regime, and submits policy-bounded proposals. Scheduled automation is intentionally restricted to a defensive repay-only guardian; full agent actions are manually dispatched.

### Links

- **Live app**: https://sigma-two-iota.vercel.app
- **Repository**: https://github.com/dmetagame/sigma
- **Demo video**: _(to be added)_
- **Hardened deployment record**: [docs/DEPLOYMENT-2026-06-11.md](https://github.com/dmetagame/sigma/blob/main/docs/DEPLOYMENT-2026-06-11.md)
- **Security review**: [docs/SECURITY-REVIEW-2026-06-07.md](https://github.com/dmetagame/sigma/blob/main/docs/SECURITY-REVIEW-2026-06-07.md) and [docs/AUDIT-2026-06-10.md](https://github.com/dmetagame/sigma/blob/main/docs/AUDIT-2026-06-10.md)
- **Independent audit scope**: [docs/INDEPENDENT-AUDIT-SCOPE.md](https://github.com/dmetagame/sigma/blob/main/docs/INDEPENDENT-AUDIT-SCOPE.md)
- **Block explorer**: https://explorer.testnet.chain.robinhood.com/address/0x3517b74800E6A731656D8cc809d77f730da4d1dA (Sigma Core, Stylus, activated)

### Tech stack

Stylus · Rust · WASM · Solidity 0.8.27 · Foundry · OpenZeppelin Contracts · TypeScript · AI SDK · Google Gemini 2.5 Flash · Anthropic Claude (alt) · viem · wagmi · Next.js 16 · Vercel · Pyth · RedStone · Blockscout · Slither.

### What is honestly open

This is a testnet system reviewed by the maintainers with third-party static analysis. Before any real-value deployment, Sigma needs an independent professional Solidity and Stylus audit, multisig + timelock on owner powers, real lender accounting (interest, reserves, bad debt), and a decentralized oracle path. We say so on the dashboard footer and in `docs/AUDIT-2026-06-06.md`.

---

## Submission field map (HackQuest)

| Field | Use |
|---|---|
| Project name | **Sigma** |
| Tagline | On-chain portfolio risk engine for tokenized equity collateral. |
| Description (short) | Use the ≈150-word block above. |
| Description (long) | Use the full submission body above. |
| Tracks | Robinhood Chain reserved slot · Best Agentic Project |
| Repo | https://github.com/dmetagame/sigma |
| Live demo | https://sigma-two-iota.vercel.app |
| Video | _(add YouTube unlisted URL after recording)_ |
| Deployment chain | Robinhood Chain testnet (chain id 46630) |
| Primary contract | `0x3517b74800E6A731656D8cc809d77f730da4d1dA` (Sigma Core, Stylus) |
| Team | dmetagame |
