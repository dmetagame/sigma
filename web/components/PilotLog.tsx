"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  decodeEventLog,
  parseAbiItem,
  type Address,
} from "viem";
import { robinhoodTestnet } from "@/lib/chain";
import { DEPLOYMENT, EXPLORER } from "@/lib/contracts";
import { strategistAbi } from "@/lib/abis";

const actionExecutedEvent = parseAbiItem(
  "event ActionExecuted(address indexed user, address indexed agent, uint8 indexed action, bytes data, string rationale)",
);

interface ActionLog {
  tx: `0x${string}`;
  blockNumber: bigint;
  user: Address;
  agent: Address;
  action: number;
  rationale: string;
}

const ACTION_LABEL = ["Borrow", "Repay", "Withdraw"];

export function PilotLog() {
  const [logs, setLogs] = useState<ActionLog[] | null>(null);

  useEffect(() => {
    const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });
    let cancelled = false;

    async function load() {
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
        const raw = await client.getLogs({
          address: DEPLOYMENT.sigmaStrategist,
          fromBlock,
          toBlock: latest,
          event: actionExecutedEvent,
        });
        if (cancelled) return;
        const parsed: ActionLog[] = raw
          .map((log) => {
            try {
              const decoded = decodeEventLog({
                abi: strategistAbi,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName !== "ActionExecuted") return null;
              const args = decoded.args as unknown as {
                user: Address;
                agent: Address;
                action: number;
                rationale: string;
              };
              return {
                tx: log.transactionHash!,
                blockNumber: log.blockNumber!,
                user: args.user,
                agent: args.agent,
                action: Number(args.action),
                rationale: args.rationale,
              };
            } catch {
              return null;
            }
          })
          .filter((x): x is ActionLog => x !== null)
          .reverse();
        setLogs(parsed);
      } catch {
        setLogs([]);
      }
    }

    load();
    const id = setInterval(load, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section id="pilot" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-3">Sigma Pilot · decision log</p>
            <h2>
              Every agent action gets <br />
              a rationale on-chain.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-5 text-muted">
            The Strategist emits an{" "}
            <span className="font-mono text-text text-sm">ActionExecuted</span> event with
            the agent's free-form rationale string for every successful action. Audit log
            is the chain itself.
          </div>
        </div>

        <div className="panel">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border">
            <p className="eyebrow col-span-2">Block</p>
            <p className="eyebrow col-span-2">Action</p>
            <p className="eyebrow col-span-3">User</p>
            <p className="eyebrow col-span-5">Rationale</p>
          </div>
          {logs === null && <div className="px-5 py-6 text-muted">Loading…</div>}
          {logs?.length === 0 && (
            <div className="px-5 py-6 text-muted">
              No actions yet — register a policy and run a Pilot tick to populate.
            </div>
          )}
          {logs?.map((l) => (
            <div
              key={l.tx}
              className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-border last:border-b-0 items-start"
            >
              <a
                href={`${EXPLORER}/tx/${l.tx}`}
                target="_blank"
                rel="noreferrer"
                className="col-span-2 font-mono text-sm text-muted hover:text-accent"
              >
                #{l.blockNumber.toString()}
              </a>
              <div className="col-span-2">
                <span className="font-mono text-sm border border-accent text-accent px-2 py-0.5">
                  {ACTION_LABEL[l.action] ?? `act ${l.action}`}
                </span>
              </div>
              <div className="col-span-3 font-mono text-sm">
                {l.user.slice(0, 6)}…{l.user.slice(-4)}
              </div>
              <div className="col-span-5 text-sm text-muted leading-snug">
                {l.rationale || <span className="italic">(empty)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
