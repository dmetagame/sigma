# Hardened deployment - 2026-06-07

Network: Robinhood Chain testnet, chain ID `46630`.

Production app: https://sigma-two-iota.vercel.app

Vercel production deployment:

- Deployment ID: `dpl_EQJgaraq7tQk597G7czB4FwvUqSk`
- Immutable URL: https://sigma-ck43bxqas-dmetagames-projects.vercel.app
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
| Oracle Adapter | `0x148E41B44f53a31D2C040663bEA26CA392aB59bb` | `0x48f57e87b2c49743eed9cf759e14f61ca4e283adb31ee11356b46e6c8d51bd3b` |
| Sigma Vault | `0xB2aFb921AA8cE9F53f678782840216661f0d849d` | `0x7e1848a633e24f0e56fb46a98b941b95688af2e825f8b1d059c65d2e6d275dea` |
| Sigma Strategist | `0x506aB1734D63748F0aDBCB74C13187E96A0D803a` | `0xb3e314a2bed494d9de17f2519adfbd9d633dbb810683e0b59ab767a1656d48ad` |

The Strategist deployment block is `70791926`.

## Demo state

- Demo user: `0xD3eed2f7dcED5fbc96Fb1a0FC058C540D50b4f80`
- Pilot: `0x2a73462D71b9D61425997a6F14f63c31c3440f3e`
- Collateral: 1 TSLA at the seeded testnet price of 280 USDC
- Portfolio value: 280 USDC
- Debt: 50 USDC
- One-day 95% VaR: 13.056782 USDC
- Max borrowable: 224 USDC, constrained by the 80% base-LTV ceiling
- Health factor: 4.48
- Remaining Vault liquidity: 150 USDC

Pilot Borrow transaction:
`0xaf406078fc1106c456e43e62d62bc6c3572319c2f2e6c27f8ad630d644882d15`

The transaction emits `ActionExecuted` with the rationale:
`Demo borrow: 50 USDC after portfolio VaR and the 80% base-LTV check`.

## Legacy deployment

The previous Vault `0xF0221bDE2cdf11b9855F91B491597076d27804Cf` and Strategist `0xB4821E0617b8e3c8Ddd7359A9f338e7176A0633b` remain on-chain for historical reference. They predate the liquidation and repayment hardening and must not be used.
