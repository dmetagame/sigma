# Sigma contracts

Foundry project for the Solidity layer of Sigma.

## Components

- `SigmaVault.sol`: tokenized-stock collateral, USDC debt, VaR and base-LTV checks, bounded liquidation.
- `SigmaStrategist.sol`: user policy registration and agent-only guarded execution.
- `ChainlinkOracleAdapter.sol`: Chainlink-compatible feeds with staleness checks plus an explicit testnet fallback.
- `ISigmaCore.sol`: interface to the Stylus VaR engine.

## Verify

```bash
forge fmt --check
forge build
forge test -vv
```

## Trust model

The owner can add assets, update risk inputs, replace the oracle/Core, and set fallback prices. The demo owner is an EOA. A production version requires governance delay, multisig control, monitored feeds, and an independent audit.
