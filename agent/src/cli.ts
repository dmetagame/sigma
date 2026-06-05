import { type Address } from "viem";
import { runTick } from "./agent.js";
import { pilotAddress } from "./client.js";

function parseArgs(): { mode: "tick" | "loop"; user: Address; dryRun: boolean; intervalMs: number } {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode !== "tick" && mode !== "loop") {
    console.error("usage: tsx src/cli.ts <tick|loop> --user 0x... [--dry] [--interval=30000]");
    process.exit(1);
  }
  let user: Address | null = null;
  let dryRun = false;
  let intervalMs = 30_000;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--user") user = rest[++i] as Address;
    else if (arg === "--dry") dryRun = true;
    else if (arg.startsWith("--interval=")) intervalMs = Number(arg.slice("--interval=".length));
  }
  if (!user) {
    console.error("--user 0xAddress is required");
    process.exit(1);
  }
  return { mode, user, dryRun, intervalMs };
}

async function main() {
  const { mode, user, dryRun, intervalMs } = parseArgs();
  console.log(`Sigma Pilot — eoa=${pilotAddress()} user=${user} dry=${dryRun}`);

  if (mode === "tick") {
    const out = await runTick({ user, dryRun });
    console.log("---");
    console.log(out.text);
    console.log(`---\nfinish=${out.finishReason} toolCalls=${out.toolCalls}`);
    return;
  }

  for (;;) {
    try {
      const out = await runTick({ user, dryRun });
      console.log(`[${new Date().toISOString()}] tick:`);
      console.log(out.text);
      console.log(`(finish=${out.finishReason} tools=${out.toolCalls})`);
    } catch (e) {
      console.error(`tick error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
