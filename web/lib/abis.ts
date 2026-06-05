export const vaultAbi = [
  {
    type: "function",
    name: "supportedStocks",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "collateral",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "debt",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "portfolioValue",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "computeVaR",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "maxBorrowable",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "health",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "oracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "executor",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const oracleAbi = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const strategistAbi = [
  {
    type: "function",
    name: "policyOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "maxBorrow6", type: "uint256" },
      { name: "maxStockShare", type: "uint256" },
      { name: "minHealthFactor", type: "uint256" },
      { name: "cooldownSec", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "ActionExecuted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "action", type: "uint8", indexed: true },
      { name: "data", type: "bytes", indexed: false },
      { name: "rationale", type: "string", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const sigmaCoreAbi = [
  {
    type: "function",
    name: "computePortfolioVar",
    stateMutability: "view",
    inputs: [
      { name: "weights", type: "uint256[]" },
      { name: "vols", type: "uint256[]" },
      { name: "corrPacked", type: "int256[]" },
      { name: "portfolioValue", type: "uint256" },
      { name: "zScore", type: "uint256" },
      { name: "horizonSqrt", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
