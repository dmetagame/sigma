# Security policy

Sigma is testnet software and has not received an independent professional
audit. Do not use it with real funds.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting flow for this repository:

https://github.com/dmetagame/sigma/security/advisories/new

Include the affected commit, contract or component, reproduction steps, impact,
and any suggested remediation. Do not open a public issue for an unpatched
fund-loss or key-compromise vulnerability.

## Supported version

Only the current `main` branch and the deployment addresses documented in the
latest file under `docs/DEPLOYMENT-*.md` are supported. Earlier Vault,
Strategist, and Oracle deployments are retained only as historical evidence.

## Trust boundaries

- The Vault owner can change risk parameters, add supported assets, and replace
  the Core or Oracle.
- The active testnet Oracle accepts updates from one dedicated reporter EOA.
  The updater cross-checks Pyth and RedStone, but this is not equivalent to an
  on-chain decentralized oracle network.
- Each user explicitly selects one Pilot EOA and immutable-on-execution policy
  bounds in the Strategist.
- Scheduled Pilot automation is repay-only and deterministic. Borrow and
  withdrawal tools are available only during manually dispatched demo ticks.
- GitHub Actions and Vercel hold testnet-only keys. Mainnet operation requires
  hardware-backed signing, multisig ownership, timelocks, and monitoring.
