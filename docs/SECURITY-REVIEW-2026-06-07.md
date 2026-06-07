# Security review - 2026-06-07

## Status

This is a maintainer review supported by third-party static-analysis tooling.
It is not an independent professional audit and must not be presented as one.

Reviewed commit scope: Solidity contracts, Stylus VaR engine, Pilot transaction
path, oracle updater, deployment scripts, and public web reads.

## Verification performed

- Foundry: 36 tests passing, including 512 fuzz runs across two Vault safety
  properties.
- Rust: unit tests, formatting, and Clippy with warnings denied.
- Slither 0.11.5: 0 findings after remediation and documented exclusions.
- TypeScript: strict builds for the agent and web application.
- Production dependency audit: 0 known npm vulnerabilities.
- On-chain smoke tests: contract code, wiring, LTV, portfolio state, liquidity,
  and zero-repayment liquidation rejection.

Run the reproducible local suite with:

```bash
./scripts/security-check.sh
```

## Slither triage

The following detector classes are excluded from the blocking command after
manual review:

| Detector | Rationale |
|---|---|
| `arbitrary-send-erc20` | Repayment pulls from the policy owner only after that user approves the Strategist and selects the sole agent. |
| `calls-loop` | The Vault caps supported assets at 16; oracle and collateral reads are intentionally bounded. |
| `timestamp` | Freshness and cooldown checks tolerate normal block timestamp variance and do not depend on sub-minute precision. |
| `unused-return` | The legacy Chainlink-compatible adapter intentionally ignores `startedAt`; it validates `updatedAt`, round completion, sign, and staleness. |

## Remediated during review

1. Liquidation previously allowed collateral seizure with zero effective
   repayment. Zero repayment is now rejected and seized value is capped by the
   configured liquidation bonus.
2. Repayment previously risked retaining excess USDC in the Strategist. The
   transfer is now capped to outstanding debt.
3. VaR alone could permit unsafe borrowing when variance was understated. An
   independent 80% base-LTV ceiling now applies.
4. Oracle reads now reject stale/incomplete rounds. The active deployment uses
   a timestamped reporter adapter with source-agreement and deviation checks.
5. Pilot ticks are limited to one action attempt and simulate transactions
   before submission.
6. Strategist cooldown state is written before external interactions, with
   transaction rollback preserving correctness on failure.
7. Concentration calculations use full-precision `mulDiv` arithmetic.

## Open external requirement

A genuine independent audit remains outstanding. Before any mainnet or
real-value deployment, engage a qualified Solidity and Stylus auditor to review
the exact release commit and deployed bytecode. The audit should include owner
governance, oracle operations, liquidation economics, cross-language numerical
equivalence, key management, and hosted automation.
