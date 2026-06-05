import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Load .env.local from repo root.
config({ path: resolve(here, "../../.env.local") });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

type Provider = "google" | "anthropic";

function resolveProvider(): Provider {
  const explicit = (process.env.PILOT_PROVIDER ?? "").toLowerCase();
  if (explicit === "google" || explicit === "anthropic") return explicit;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    "No LLM key found. Set GOOGLE_GENERATIVE_AI_API_KEY (free, recommended) or ANTHROPIC_API_KEY.",
  );
}

const provider = resolveProvider();
const defaultModel =
  provider === "google" ? "gemini-2.0-flash" : "claude-sonnet-4-6";

export const env = {
  RH_TESTNET_RPC:
    process.env.RH_TESTNET_RPC ?? "https://rpc.testnet.chain.robinhood.com",
  RH_TESTNET_CHAIN_ID: Number(process.env.RH_TESTNET_CHAIN_ID ?? "46630"),
  RH_TESTNET_EXPLORER:
    process.env.RH_TESTNET_EXPLORER ??
    "https://explorer.testnet.chain.robinhood.com",
  PILOT_PROVIDER: provider,
  // Either Anthropic or Google key — Pilot picks the matching SDK.
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  // The Pilot's own EOA — registered as `agent` in each user's Policy.
  PILOT_PRIVATE_KEY: required("PILOT_PRIVATE_KEY"),
  // Deployment addresses — populated after deploy script runs.
  SIGMA_CORE_ADDR: process.env.SIGMA_CORE_ADDR ?? "",
  SIGMA_VAULT_ADDR: process.env.SIGMA_VAULT_ADDR ?? "",
  SIGMA_STRATEGIST_ADDR: process.env.SIGMA_STRATEGIST_ADDR ?? "",
  USDC_ADDR: process.env.USDC_ADDR ?? "",
  // Model selection — provider-appropriate default.
  PILOT_MODEL: process.env.PILOT_MODEL ?? defaultModel,
} as const;
