// Minimal ABIs the Pilot needs. Kept hand-written so the agent package has no
// build-time dependency on Foundry artifacts.

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
    name: "executeAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "action", type: "uint8" }, // 0=Borrow, 1=Repay, 2=Withdraw
      { name: "data", type: "bytes" },
      { name: "rationale", type: "string" },
    ],
    outputs: [],
  },
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
    type: "function",
    name: "lastActionAt",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
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
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const ActionType = {
  Borrow: 0,
  Repay: 1,
  Withdraw: 2,
} as const;

export type ActionTypeName = keyof typeof ActionType;
