# Security review - 2026-06-07

## Status

This is a maintainer review supported by third-party static-analysis tooling.
It is not an independent professional audit and must not be presented as one.

Reviewed commit scope: Solidity contracts, Stylus VaR engine, Pilot transaction
path, oracle updater, deployment scripts, and public web reads.

## Verification performed

- Foundry: 37 tests passing, including 512 fuzz runs across two Vault safety
  properties.
- Agent guardian: 3 deterministic repayment-planning tests.
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
| `cyclomatic-complexity` | `executeAction` is an enum dispatcher whose three branches and exceptional repay treatment are covered by focused tests. The deployed source is kept byte-for-byte aligned with the reviewed migration build. |
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
8. Repayment bypasses action cooldown and postconditions that could otherwise
   prevent partial deleveraging from an already non-compliant position.
9. Scheduled automation is a deterministic repay-only guardian. The mock
   time-varying market regime can affect only manually dispatched demo ticks.

## Open external requirement

A genuine independent audit remains outstanding. Before any mainnet or
real-value deployment, engage a qualified Solidity and Stylus auditor to review
the exact release commit and deployed bytecode. The audit should include owner
governance, oracle operations, liquidation economics, cross-language numerical
equivalence, key management, and hosted automation.

## Residual review - 2026-06-08

A second pass found and remediated two additional risks:

1. Repayment could be blocked by cooldown or by policy postconditions that the
   repayment itself could not worsen. The replacement Strategist permits
   partial deleveraging regardless of those pre-existing conditions.
2. Recurring full-agent ticks could change leverage based on the illustrative
   time-rotating regime. Scheduled execution is now a deterministic repay-only
   guardian; full AI actions require explicit manual dispatch.

The active Strategist address and migration receipts are recorded in
`DEPLOYMENT-2026-06-07.md`.
