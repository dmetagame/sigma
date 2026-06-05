import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, type LanguageModel } from "ai";
import { type Address } from "viem";
import { env } from "./config.js";
import { buildTools } from "./tools.js";
import { pilotAddress } from "./client.js";

function model(): LanguageModel {
  return env.PILOT_PROVIDER === "google"
    ? google(env.PILOT_MODEL)
    : anthropic(env.PILOT_MODEL);
}

const SYSTEM_PROMPT = `You are Sigma Pilot, an autonomous risk-management agent operating an on-chain
collateralized lending position on Robinhood Chain.

Goals, in order:
  1. Keep the user's position safely above their policy minimum health factor.
     If the position is already unhealthy or close to it, your job is to
     deleverage immediately — propose a Repay or Withdraw (after Repay).
  2. Match leverage to the prevailing market regime:
       calm     → up to maxBorrow is acceptable if user wants leverage
       volatile → keep meaningful buffer; do not add leverage
       stressed → actively reduce leverage / increase cash buffer
  3. Stay within all policy guardrails (cooldown, borrow cap, concentration,
     min health). If unsure, do nothing this tick.

Workflow each tick:
  1. Call getPortfolioState to read the on-chain truth.
  2. Call getMarketRegime to read the current regime signal.
  3. Decide: act or pass. Acting means calling exactly ONE proposeXxx tool.
  4. Every proposed action MUST include a clear rationale string referencing
     the specific numbers (debt, health, VaR, regime) that drove it. The
     rationale is recorded on-chain as part of the action receipt.

Never call multiple action tools in the same tick. Never propose actions
without first reading state. If the read shows no debt and a healthy buffer
in a calm regime, the correct answer is usually to pass without acting.`;

export interface TickOptions {
  user: Address;
  /** When true, do not actually submit txs; report intended action only. */
  dryRun?: boolean;
}

export interface TickResult {
  finishReason: string;
  text: string;
  toolCalls: number;
  pilotAddress: Address;
}

export async function runTick(opts: TickOptions): Promise<TickResult> {
  const tools = buildTools(opts.user);
  if (opts.dryRun) {
    // Strip mutating tools so the model can only inspect state.
    delete (tools as Partial<typeof tools>).proposeBorrow;
    delete (tools as Partial<typeof tools>).proposeRepay;
    delete (tools as Partial<typeof tools>).proposeWithdraw;
  }

  const result = await generateText({
    model: model(),
    system: SYSTEM_PROMPT,
    prompt: `Run one decision tick for user ${opts.user}. ${
      opts.dryRun
        ? "DRY RUN — propose a decision in writing only, do not execute."
        : "Execute at most one action if appropriate."
    }`,
    tools,
    stopWhen: stepCountIs(6),
  });

  return {
    finishReason: result.finishReason,
    text: result.text,
    toolCalls: result.steps.reduce((acc, s) => acc + s.toolCalls.length, 0),
    pilotAddress: pilotAddress(),
  };
}
