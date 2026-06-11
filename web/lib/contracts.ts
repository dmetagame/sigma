import type { Address } from "viem";

export const DEPLOYMENT = {
  chainId: 46630,
  sigmaCore: "0x3517b74800E6A731656D8cc809d77f730da4d1dA" as Address,
  sigmaVault: "0x077292Dbc17214719d09FAcFA58915F48525E0AF" as Address,
  sigmaStrategist: "0x652C206Add1418a09C34e7be311611D79a422B78" as Address,
  sigmaStrategistDeploymentBlock: 72_892_596n,
  strategistHistory: [
    {
      address: "0xB4821E0617b8e3c8Ddd7359A9f338e7176A0633b" as Address,
      deploymentBlock: 69_611_116n,
    },
    {
      address: "0x506aB1734D63748F0aDBCB74C13187E96A0D803a" as Address,
      deploymentBlock: 70_791_926n,
    },
    {
      address: "0x6Dc8E010DA00687eA823C1283b3fA8C9ED5436dB" as Address,
      deploymentBlock: 71_496_717n,
    },
    {
      address: "0x652C206Add1418a09C34e7be311611D79a422B78" as Address,
      deploymentBlock: 72_892_596n,
    },
  ],
  oracleAdapter: "0x49E038450866157b3B0f790992690EcE842602E0" as Address,
  solidityBenchmark: "0x3f64d310B88f8c89aFd70ccCD33094DF7e7c3a91" as Address,
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
