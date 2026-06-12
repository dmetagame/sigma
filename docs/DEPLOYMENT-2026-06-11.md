# Vault migration - 2026-06-11

Network: Robinhood Chain testnet, chain ID `46630`.

This migration applies the remediations from
[`AUDIT-2026-06-10.md`](AUDIT-2026-06-10.md): the replacement Vault adds
owner-updatable per-stock volatility (`setVol`) and drops a dead storage
write. The Stylus core and cross-checked oracle adapter are retained from the
2026-06-07 deployment; only the Vault and Strategist were redeployed.

## Active contracts

| Component | Address | Deployment |
|---|---|---|
| Sigma Core (Stylus, retained) | `0x3517b74800E6A731656D8cc809d77f730da4d1dA` | Existing activated deployment |
| Cross-checked Oracle Adapter (retained) | `0x49E038450866157b3B0f790992690EcE842602E0` | See `DEPLOYMENT-2026-06-07.md` |
| Sigma Vault | `0x077292Dbc17214719d09FAcFA58915F48525E0AF` | `0xd3af4cd730d0e93b4e1cc52089ade7705b4e9d04f8d634d41e2c44ad10b57ef6`, block `72892410` |
| Sigma Strategist | `0x652C206Add1418a09C34e7be311611D79a422B78` | `0x786f0cfde694f6ce9aecd63ba9f812119eea5e15274a89991ff1a7d861642ef3`, block `72892596` |
| Solidity benchmark core (retained) | `0x3f64d310B88f8c89aFd70ccCD33094DF7e7c3a91` | See `DEPLOYMENT-2026-06-07.md` |

`setVol` was exercised live after deployment:
`0xb3877294279743f282ae6a057dc88d85627d2efede131c177acfc18f81bdfdcb`.

## Liquidity recovery from the legacy vault

The legacy vault held the 200 USDC demo liquidity with no owner withdrawal
path (by design). It was recovered as a standard borrow: the demo user
deposited one additional TSLA and borrowed the full 200 USDC, leaving the
legacy position as an ordinary healthy loan (2 TSLA collateral, 200 USDC
debt, health ≈ 3.0) that no automation touches.

- Approve TSLA: `0x17ddceb9f9e5f65111c47ad300bcdf8fbb2547ca8fd3c9937eea78be53cce210`
- Deposit TSLA: `0x66549ecd23887c44e43fffb40b89a4942309570f2608cae3f15ee20eab3e42c2`
- Borrow 200 USDC: `0x59d08d7b52cb13fc65b5dbab2b08896611bdd82b27c4dff4f918d9b94ef6405e`

Legacy hygiene (old Strategist `0x6Dc8E010DA00687eA823C1283b3fA8C9ED5436dB`):

- Deactivate old policy: `0x779681ed1a6ba39b84a89ee77dfe78de41b30a1768f77e8ccfd86c623ecc3452`
- Clear old Vault executor: `0x89f872517237c612eec2798795ed513f027bd64d416de3398dd9a4cd39b08837`
- Zero old USDC allowance: `0x50df6cba49c1322d8f5f8c09ea0269e5c532c9974b3a2f1451632eda87b6c08a`

## Demo state

Seeded via `scripts/seed-demo.sh` with a bounded 150 USDC Strategist
allowance (no longer unlimited):

- Fund vault with 200 USDC: `0x52727446da88c3edbca52d7165afbf53d4dfc105a0f5d35495697963f1cbc2d5`
- Deposit 1 TSLA: `0xc516c59144ce90fda5fe136c76ec97486ac04a514061e4e2b15f15306db2e61d`
- Set Strategist as executor: `0x3c45a08666106f2f4fbfe9235873b7d1b5b49e9ca032cfaca4558d8c55fbfa49`
- Bounded 150 USDC allowance: `0x24fb07e7cff30e10b1dd86ebae674c5bdfdd4072335940eccbce8384079b079a`
- Register policy: `0x9cb48a27c9b7c7549d10a3e33ccbec53ee41d7b5db741f30e3ac3b143900e2a3`
- Pilot demo borrow (50 USDC via `executeAction`): `0x3b3d0ee5fb2b97a0c55f0a9522822fd9a1887c8369e0f7e698251cb38a56e7cb`

Post-seed state (verified by `scripts/verify-deployment.sh`):

- Demo user: `0xD3eed2f7dcED5fbc96Fb1a0FC058C540D50b4f80`
- Pilot: `0x2a73462D71b9D61425997a6F14f63c31c3440f3e`
- Collateral: 1 TSLA; portfolio value 381.677715 USDC
- Debt: 50 USDC; max borrowable 305.342172 USDC; health 6.11
- Remaining Vault liquidity: 150 USDC

## Operations updated

- GitHub Actions variables `SIGMA_VAULT_ADDR` and `SIGMA_STRATEGIST_ADDR`
  now point at the replacement contracts; the guardian and oracle schedules
  are unchanged.
- A guardian dry run against the new Strategist passed (healthy position, no
  action).
- The web application's deployment constants and strategist event history
  were updated; the decision log now also covers the first legacy Strategist
  (`0xB4821E0617b8e3c8Ddd7359A9f338e7176A0633b`, block `69611116`).

## Addendum — 2026-06-12 demo-state refresh

Acting on the external prize-readiness audit (`sigma-prize-audit-2026-06-11`):

- Vault liquidity topped up 150 → 300 USDC, sourced from the Aave Stock fork
  Pool (`0xb6190fA4E71fA8A4DbE4De98F49f9980Ee9b4C17`) against the deployer's
  existing collateral there:
  - Borrow 150 USDC: `0x6f35548661c974a5198b0f832f66cbef8b68cff76188ad93e5a02d52d1932441`
  - Transfer to Vault: `0xa409add61285b0e5ece703fd114f2bf95a7c37e652400ac858d25cadf9281663`
- Demo basket diversified from 1 TSLA to all five stocks so correlation terms
  carry real weight in the portfolio VaR:
  - Deposit 0.8 AMD: `0xaf4b50a2a581a0745d6eb16d29facbd6de5fc4bceae52b77a3210da93c1bb4f3`
  - Deposit 1.6 AMZN: `0xc6f7dd732a1a8aa4e48442eff78a5222795ab87691b4d47efa66348802fdeb72`
  - Deposit 4.8 NFLX: `0x523bb3652f1c5c4e1416cb0e3383825ab7a7262df654c68750ac2338444f0c4c`
  - Deposit 3.0 PLTR: `0xabff229f4545a177e6a203b9ea099fef4c693344dbc74db5bc01d03e23f01d61`
- Fresh full-agent dispatch (`pilot.yml`, mode `execute`): the Pilot read the
  stressed demo regime and repaid the entire 50 USDC debt with its rationale
  recorded on-chain:
  `0x9694ac235fb8515a049768a1cf59e81f77dc50c9925aed90243663f2e60e4885`
  (block `74138727`, gas `345973`).

Resulting demo state: portfolio value 1,945.78 USDC across five stocks, VaR
72.27 USDC (≈93.6 USDC if the same basket were priced without diversification
— the correlation benefit is now visible on-chain), max borrowable 1,556.63
USDC, debt 0, Vault USDC liquidity 350.

## Legacy deployments

The 2026-06-07 record remains in
[`DEPLOYMENT-2026-06-07.md`](DEPLOYMENT-2026-06-07.md). Legacy Vaults
`0xF0221bDE2cdf11b9855F91B491597076d27804Cf` and
`0xB2aFb921AA8cE9F53f678782840216661f0d849d`, and Strategists
`0xB4821E0617b8e3c8Ddd7359A9f338e7176A0633b`,
`0x506aB1734D63748F0aDBCB74C13187E96A0D803a`, and
`0x6Dc8E010DA00687eA823C1283b3fA8C9ED5436dB` remain on-chain for history and
must not be used.
