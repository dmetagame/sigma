import { tool } from "ai";
import { z } from "zod";
import { encodeAbiParameters, type Address } from "viem";
import { env } from "./config.js";
import { makePublicClient, makeWalletClient, pilotAddress } from "./client.js";
import { strategistAbi, ActionType, type ActionTypeName } from "./abi.js";
import { readPortfolioState, summarize } from "./state.js";
import { readMarketRegime } from "./regime.js";

const addr = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address");

export function buildTools(user: Address) {
  const pilot = pilotAddress();

  return {
    getPortfolioState: tool({
      description:
        "Read the user's on-chain portfolio state: positions, value, debt, VaR, max borrow, health factor.",
      inputSchema: z.object({}),
      execute: async () => {
        const state = await readPortfolioState(user, pilot);
        return summarize(state);
      },
    }),

    getMarketRegime: tool({
      description:
        "Read the latest market-regime signal: regime label, directional score, and reasoning.",
      inputSchema: z.object({}),
      execute: async () => {
        const r = readMarketRegime();
        return `regime=${r.regime} visScore=${r.visScore} reasoning="${r.reasoning}"`;
      },
    }),

    proposeBorrow: tool({
      description:
        "Borrow USDC against the user's collateral. Use when leverage is appropriate for the current regime AND health stays comfortably above the policy minimum.",
      inputSchema: z.object({
        amount6: z
          .string()
          .describe("USDC amount in 6-decimal units, as a string (bigint-safe)"),
        rationale: z.string().min(20),
      }),
      execute: async ({ amount6, rationale }) => {
        return submitAction(user, "Borrow", encodeUint256(BigInt(amount6)), rationale);
      },
    }),

    proposeRepay: tool({
      description:
        "Repay USDC debt on behalf of the user. Requires user to have approved the Strategist on USDC.",
      inputSchema: z.object({
        amount6: z.string().describe("USDC amount in 6-decimal units"),
        rationale: z.string().min(20),
      }),
      execute: async ({ amount6, rationale }) => {
        return submitAction(user, "Repay", encodeUint256(BigInt(amount6)), rationale);
      },
    }),

    proposeWithdraw: tool({
      description:
        "Withdraw a specific stock token from the user's vault position back to the user's wallet.",
      inputSchema: z.object({
        stock: addr,
        amount18: z
          .string()
          .describe("stock token amount in 18-decimal units"),
        rationale: z.string().min(20),
      }),
      execute: async ({ stock, amount18, rationale }) => {
        const data = encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [stock as Address, BigInt(amount18)],
        );
        return submitAction(user, "Withdraw", data, rationale);
      },
    }),
  };
}

function encodeUint256(value: bigint): `0x${string}` {
  return encodeAbiParameters([{ type: "uint256" }], [value]);
}

async function submitAction(
  user: Address,
  action: ActionTypeName,
  data: `0x${string}`,
  rationale: string,
): Promise<string> {
  const wc = makeWalletClient();
  const pc = makePublicClient();
  const strategist = env.SIGMA_STRATEGIST_ADDR as Address;
  if (!strategist)
    throw new Error("SIGMA_STRATEGIST_ADDR is not set in .env.local");

  const account = wc.account!;

  // Simulate first via simulateContract — surfaces policy reverts with the
  // actual error name (e.g. NotAgent, BorrowCapExceeded) rather than a raw
  // RPC error message.
  try {
    await pc.simulateContract({
      account,
      address: strategist,
      abi: strategistAbi,
      functionName: "executeAction",
      args: [user, ActionType[action], data, rationale],
    });
  } catch (e) {
    return `SIMULATION REVERTED: ${(e as Error).message.split("\n")[0] ?? String(e)}`;
  }

  const hash = await wc.writeContract({
    account,
    chain: wc.chain!,
    address: strategist,
    abi: strategistAbi,
    functionName: "executeAction",
    args: [user, ActionType[action], data, rationale],
  });
  const receipt = await pc.waitForTransactionReceipt({ hash });
  return `executed ${action} ${rationale.slice(0, 60)} — tx ${hash} status=${receipt.status} gas=${receipt.gasUsed}`;
}
