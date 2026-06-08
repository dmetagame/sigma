import { encodeAbiParameters, type Address } from "viem";
import { pilotAddress } from "./client.js";
import { planDefensiveRepay } from "./guardian-plan.js";
import { readPortfolioState } from "./state.js";
import { submitAction } from "./tools.js";

export async function runGuardian(user: Address, dryRun: boolean): Promise<string> {
  const state = await readPortfolioState(user, pilotAddress());
  const plan = planDefensiveRepay(state);
  if (!plan) return "Guardian pass: no permitted defensive repayment is required or funded.";
  if (dryRun) return `Guardian dry run: ${plan.reason}`;

  const data = encodeAbiParameters([{ type: "uint256" }], [plan.amount6]);
  return submitAction(user, "Repay", data, plan.reason);
}
