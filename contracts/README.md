# Sigma contracts

Foundry project for the Solidity layer of Sigma.

## Components

- `SigmaVault.sol`: tokenized-stock collateral, USDC debt, VaR and base-LTV checks, bounded liquidation.
- `SigmaStrategist.sol`: user policy registration and agent-only guarded execution.
- `CrossCheckedOracleAdapter.sol`: timestamped reporter updates with freshness, monotonicity, deviation, and pause controls.
- `ChainlinkOracleAdapter.sol`: Chainlink-compatible feeds with staleness checks for networks where feeds are deployed.
- `SoliditySigmaCore.sol`: behavior-matched reference used to benchmark the Stylus implementation.
- `ISigmaCore.sol`: interface to the Stylus VaR engine.

## Verify

```bash
forge fmt --check
forge build
forge test -vv
```

## Trust model

The owner can add assets, update risk inputs, replace the Oracle/Core, tune oracle limits, and pause oracle reads. A separate reporter publishes prices after the hosted updater cross-checks Pyth and RedStone; this is still a centralized testnet trust boundary. Production requires an on-chain decentralized feed path, governance delay, multisig control, monitoring, and an independent audit.
