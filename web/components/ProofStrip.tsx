"use client";

import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { DEPLOYMENT, EXPLORER, GITHUB_REPO } from "@/lib/contracts";
import { oracleAbi } from "@/lib/abis";
import { publicClient } from "@/lib/public-client";

const actionExecutedEvent = parseAbiItem(
  "event ActionExecuted(address indexed user, address indexed agent, uint8 indexed action, bytes data, string rationale)",
);

interface LiveProof {
  priceAgeSec?: number;
  latestAgentTx?: `0x${string}`;
  latestAgentBlock?: bigint;
}

function ageLabel(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5_400) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3_600).toFixed(1)}h`;
}

async function findLatestAgentAction(): Promise<{ tx: `0x${string}`; block: bigint } | undefined> {
  // Scan backwards from the head so the common case (a recent action) costs
  // one getLogs call instead of walking forward from the deployment block.
  const latest = await publicClient.getBlockNumber();
  const floor = DEPLOYMENT.sigmaStrategistDeploymentBlock;
  for (let to = latest; to >= floor; to -= 50_000n) {
    const from = to - 49_999n > floor ? to - 49_999n : floor;
    const logs = await publicClient.getLogs({
      address: DEPLOYMENT.sigmaStrategist,
      fromBlock: from,
      toBlock: to,
      event: actionExecutedEvent,
    });
    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      return { tx: last.transactionHash!, block: last.blockNumber! };
    }
    if (from === floor) break;
  }
  return undefined;
}

export function ProofStrip() {
  const [proof, setProof] = useState<LiveProof>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [[, observedAt], block, action] = await Promise.all([
          publicClient.readContract({
            address: DEPLOYMENT.oracleAdapter,
            abi: oracleAbi,
            functionName: "priceOf",
            args: [DEPLOYMENT.stocks[0].address],
          }),
          publicClient.getBlock(),
          findLatestAgentAction(),
        ]);
        if (cancelled) return;
        setProof({
          priceAgeSec: Number(block.timestamp - observedAt),
          latestAgentTx: action?.tx,
          latestAgentBlock: action?.block,
        });
      } catch {
        // Leave the static proof links in place; live cells show placeholders.
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const badge = (workflow: string, label: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://img.shields.io/github/actions/workflow/status/dmetagame/sigma/${workflow}?branch=main&label=${label}&style=flat-square&labelColor=121519`}
      alt={`${label} workflow status`}
      className="h-5"
    />
  );

  return (
    <section className="border-b border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-muted">
        <span className="eyebrow">Proof</span>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent"
        >
          github.com/dmetagame/sigma
        </a>
        <a href={GITHUB_REPO + "/actions"} target="_blank" rel="noreferrer" className="flex items-center gap-2">
          {badge("ci.yml", "ci")}
          {badge("oracle-update.yml", "oracle")}
          {badge("pilot.yml", "guardian")}
        </a>
        <span>
          oracle prices{" "}
          <span className="text-text">
            {proof.priceAgeSec === undefined ? "…" : `${ageLabel(proof.priceAgeSec)} old`}
          </span>
        </span>
        {proof.latestAgentTx ? (
          <a
            href={`${EXPLORER}/tx/${proof.latestAgentTx}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-accent"
          >
            latest agent action · block #{proof.latestAgentBlock?.toString()}
          </a>
        ) : (
          <span>latest agent action · …</span>
        )}
      </div>
    </section>
  );
}
