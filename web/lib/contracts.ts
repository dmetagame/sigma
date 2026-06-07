import type { Address } from "viem";

export const DEPLOYMENT = {
  chainId: 46630,
  sigmaCore: "0x3517b74800E6A731656D8cc809d77f730da4d1dA" as Address,
  sigmaVault: "0xB2aFb921AA8cE9F53f678782840216661f0d849d" as Address,
  sigmaStrategist: "0x506aB1734D63748F0aDBCB74C13187E96A0D803a" as Address,
  sigmaStrategistDeploymentBlock: 70_791_926n,
  oracleAdapter: "0x148E41B44f53a31D2C040663bEA26CA392aB59bb" as Address,
  usdc: "0xAc80194dc1aE8eF52df73e7e1864fB3C62290fe0" as Address,
  stocks: [
    { symbol: "TSLA", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E" as Address },
    { symbol: "AMD", address: "0x71178BAc73cBeb415514eB542a8995b82669778d" as Address },
    { symbol: "AMZN", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" as Address },
    { symbol: "NFLX", address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93" as Address },
    { symbol: "PLTR", address: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0" as Address },
  ],
  // Hardcoded so the panels render even when no wallet is connected — shows
  // the demo user's live state.
  demoUser: "0xD3eed2f7dcED5fbc96Fb1a0FC058C540D50b4f80" as Address,
  pilotEoa: "0x2a73462D71b9D61425997a6F14f63c31c3440f3e" as Address,
} as const;

export const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
