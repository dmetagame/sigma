# Hardened deployment - 2026-06-07

Network: Robinhood Chain testnet, chain ID `46630`.

Production app: https://sigma-two-iota.vercel.app

Vercel production deployment:

- Deployment ID: `dpl_2VopQxtx6UHAGkShDBUbjLcrtc9y`
- Immutable URL: https://sigma-3eyi2glsz-dmetagames-projects.vercel.app
- Status: `READY`

Post-deployment Lighthouse results (2026-06-07):

- Performance: 84
- Accessibility: 100
- Best practices: 100
- SEO: 100
- Agentic browsing: 100
- First Contentful Paint: 1.2 s
- Largest Contentful Paint: 1.7 s
- Cumulative Layout Shift: 0

## Contracts

| Component | Address | Deployment transaction |
|---|---|---|
| Sigma Core (Stylus, retained) | `0x3517b74800E6A731656D8cc809d77f730da4d1dA` | Existing activated deployment |
| Cross-checked Oracle Adapter | `0x49E038450866157b3B0f790992690EcE842602E0` | `0xa4429dd6e0642a18bd87981924a42b4dfa8368cfd23df08babb6a3d3378aba54` |
| Sigma Vault | `0xB2aFb921AA8cE9F53f678782840216661f0d849d` | `0x7e1848a633e24f0e56fb46a98b941b95688af2e825f8b1d059c65d2e6d275dea` |
| Sigma Strategist | `0x6Dc8E010DA00687eA823C1283b3fA8C9ED5436dB` | `0x941e3a0d9217fbcb6c95b379c8b2d5333d87dbd9eedf54fbac1f73af7c82384d` |
| Solidity benchmark core | `0x3f64d310B88f8c89aFd70ccCD33094DF7e7c3a91` | `0x373c16bc4feef36405d0b81ca50d3283fc9c67e2932931ade4cc4bb79dd293dd` |

The active Strategist deployment block is `71496717`.

The initial live oracle publication transaction is
`0x7f0182e60b8b1f824bdf10c2433e363a7507919742b7d1b6523e8a9cd260ce1c`.
The Vault switched to this adapter in
`0x5bb9171344f1b4117539199fa78cb6ccdb22e281ee630018c74dbf3f395f35e6`.
The dedicated reporter is `0x100AE3d90A47363d229EdB1268BD296445e0340D`.

The updater checks Pyth and RedStone off-chain, rejects source disagreement
above 200 basis points, and publishes timestamped evidence hashes. The adapter
then enforces freshness, monotonic timestamps, sequential-deviation limits,
reporter separation, and emergency pause. This is stronger than seeded prices,
but it is not an on-chain decentralized oracle network.

## Demo state

- Demo user: `0xD3eed2f7dcED5fbc96Fb1a0FC058C540D50b4f80`
- Pilot: `0x2a73462D71b9D61425997a6F14f63c31c3440f3e`
- Collateral: 1 TSLA at the cross-checked price of 390.918750 USDC
- Portfolio value: 390.918750 USDC
- Debt: 0 USDC
- One-day 95% VaR: 18.229075 USDC
- Max borrowable: 312.735000 USDC, constrained by the 80% base-LTV ceiling
- Health factor: unbounded (no debt)
- Remaining Vault liquidity: 200 USDC

## Wallet operator interface

The production application now exposes wallet-driven deposit, withdrawal,
borrow, repayment, and Pilot policy controls. Direct token transfers use exact
approvals. Pilot setup configures a repayment allowance capped at the larger
of current debt or the policy borrow ceiling, authorizes the Strategist as the
Vault executor, and activates the policy only after those supporting
permissions are confirmed. Revocation deactivates the policy, clears executor
access, and resets the repayment allowance to zero.

Production verification on 2026-06-08 covered disconnected and injected-wallet
browser states plus the full deployment smoke test. The connected demo wallet
showed the live 150 USDC borrow cap, 100% concentration limit, 1.2 minimum
health factor, and five-second cooldown.

Pilot Borrow transaction:
`0xaf406078fc1106c456e43e62d62bc6c3572319c2f2e6c27f8ad630d644882d15`

The transaction emits `ActionExecuted` with the rationale:
`Demo borrow: 50 USDC after portfolio VaR and the 80% base-LTV check`.

Hosted Pilot verification run:
https://github.com/dmetagame/sigma/actions/runs/27100625520

The scheduled Pilot path executed one policy-bounded 100 USDC borrow, bringing
total debt to the configured 150 USDC cap:
`0x5dd8e279740b808200944e1aa9bebc5bbb887e7cf4fd8ab66ab069a06c6933d8`.

A later run of the former full-agent schedule rotated to the mock `stressed`
regime and repaid the full 150 USDC debt:
`0xbf1a6f6cc4a387c3442d096bfc82dfc11d776315960029900607a45383d4977b`.
That behavior was safe but based on a demo signal, so recurring automation is
now the deterministic repay-only guardian described below.

## Gas benchmark

`npm run benchmark:gas` estimates the same deployed five-asset, equal-weight
portfolio call and rejects any output mismatch:

| Runtime | Estimated gas |
|---|---:|
| Stylus `SigmaCore` | 122,318 |
| Solidity `SoliditySigmaCore` | 128,960 |

Measured at Robinhood Chain block `70915096`: **5.15%**. A repeat pinned to the
same block returned the same estimates. Both cores return `37,014,966,203`
USDC-6 units. This result is workload-specific and is not presented as a
universal Stylus multiplier; unpinned rollup estimates include variable L1
overhead.

## Hosted automation

- `.github/workflows/oracle-update.yml`: cross-checks and publishes prices every 30 minutes.
- `.github/workflows/pilot.yml`: runs a deterministic defensive guardian every six hours. It can only repay when health is below the user's policy minimum.
- Full AI demo-agent actions, including borrowing and withdrawing, require an explicit manual workflow dispatch.
- All automation keys are testnet-only GitHub Actions secrets.

Verified workflow runs:

- Oracle dry run: https://github.com/dmetagame/sigma/actions/runs/27100588636
- Pilot dry run: https://github.com/dmetagame/sigma/actions/runs/27100593043
- Oracle live path: https://github.com/dmetagame/sigma/actions/runs/27100621036
- Pilot live path: https://github.com/dmetagame/sigma/actions/runs/27100625520
- Defensive guardian after Strategist migration: https://github.com/dmetagame/sigma/actions/runs/27122811322

The defensive guardian verification completed successfully on 2026-06-08
against the replacement Strategist. The position was healthy with zero debt,
so the guardian correctly submitted no transaction.

The live oracle path completed without a transaction because all five Pyth
timestamps matched the already-published weekend observations. This confirms
the idempotent no-update path rather than manufacturing a new timestamp.

## Strategist safety migration

The active Strategist was replaced after a residual review found that a
pre-existing cooldown, concentration violation, or minimum-health violation
could block a partial repayment. The replacement treats repayment as strictly
risk-reducing: it bypasses cooldown and skips postconditions that repayment
cannot worsen. Borrow and withdrawal retain all policy checks.

Migration receipts:

- Deploy replacement: `0x941e3a0d9217fbcb6c95b379c8b2d5333d87dbd9eedf54fbac1f73af7c82384d`
- Set Vault executor: `0x8a53f8ed77c7ee1cdd049cf023b44a1ac533b373b2e606efe4943c7eed6583e4`
- Revoke old approval: `0x928998187d37e81c611e82d2c38ca75f184a205fd6bd3649ea3c1af6fbd198d7`
- Approve replacement: `0x84542ee49edc7aa9da10d05cdd1212347e7e5e63a28b90158352ddb6696cdb16`
- Register preserved policy: `0x7e5d19a7003fa7134a0fade546f1988aa9f34fa905b75d4a56b1d67ff3f62275`
- Deactivate old policy: `0x7c61e67f72d636d725c0d9ac0612c68db58c3ee788e2c9c14aa40fd4b513ef87`

The previous Strategist remains on-chain for history but is inactive, is no
longer the Vault executor, and has zero USDC allowance.

The active runtime bytecode is 4,549 bytes and matches the local
`SigmaStrategist` artifact after normalizing the eight constructor-patched
immutable address slots.

## Legacy deployment

The previous Vault `0xF0221bDE2cdf11b9855F91B491597076d27804Cf` and Strategists `0xB4821E0617b8e3c8Ddd7359A9f338e7176A0633b` and `0x506aB1734D63748F0aDBCB74C13187E96A0D803a` remain on-chain for historical reference. They must not be used.
