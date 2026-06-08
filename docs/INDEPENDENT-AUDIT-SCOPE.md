# Independent audit scope

Sigma has not received an independent professional audit. This document is a
handoff brief for an external Solidity and Stylus reviewer, not an audit report.

## In scope

- `contracts/src/SigmaVault.sol`
- `contracts/src/SigmaStrategist.sol`
- `contracts/src/CrossCheckedOracleAdapter.sol`
- `contracts/src/SoliditySigmaCore.sol`
- `core/src/`
- `agent/src/oracle-updater.ts`
- `agent/src/guardian.ts`
- `agent/src/guardian-plan.ts`
- `agent/src/tools.ts`
- Deployment and activation scripts under `contracts/script/`

The review should bind its report to an exact Git commit, compiler versions,
constructor arguments, deployed addresses, and runtime bytecode hashes.

## Priority questions

1. Can any borrow, withdrawal, repayment, or liquidation path violate solvency,
   repayment accounting, close-factor, or liquidation-bonus limits?
2. Are cross-language fixed-point calculations equivalent over boundary,
   rounding, overflow, malformed-vector, and maximum-asset cases?
3. Can owner, reporter, Pilot, or user-policy permissions be confused or
   escalated through reentrancy, stale state, approvals, or replacement hooks?
4. Can stale, replayed, non-monotonic, divergent, or abruptly moving prices
   reach the Vault despite updater and adapter controls?
5. Can hosted automation execute more than one mutation per tick, bypass a
   policy, leak a key, or act on incomplete reads or model output?

## Required methods

- Manual line-by-line review of Solidity and Rust/WASM behavior.
- Stateful invariant testing across multi-user borrow, repay, withdraw, and
  liquidation sequences.
- Differential and property testing between Stylus and Solidity core outputs.
- Oracle failure-mode and key-compromise analysis.
- Deployment/configuration and bytecode verification.

## Explicit trust assumptions

- Robinhood Chain testnet token contracts and RPC are external dependencies.
- The current reporter is a single testnet EOA. Pyth/RedStone agreement is
  checked by hosted code, not verified independently by the adapter.
- The owner is an EOA and can replace core infrastructure without a timelock.
- Volatility, correlation, and regime inputs are illustrative.
- GitHub Actions and Vercel are trusted for testnet automation.

## Expected deliverables

- Findings ranked by severity with reproducible proof and remediation advice.
- Confirmation of fixed-point equivalence or documented counterexamples.
- Review of test coverage and recommended additional invariants.
- Verification of remediated findings against a pinned follow-up commit.
- A clear statement that distinguishes reviewed testnet code from any future
  mainnet deployment.
