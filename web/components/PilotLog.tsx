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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });
    let cancelled = false;
    let nextBlock = DEPLOYMENT.sigmaStrategistDeploymentBlock;
    let collected: ActionLog[] = [];

    async function load() {
      try {
        const latest = await client.getBlockNumber();
        const fetched: ActionLog[] = [];
        let cursor = nextBlock;

        while (cursor <= latest) {
          const chunkEnd = cursor + 49_999n;
          const toBlock = chunkEnd < latest ? chunkEnd : latest;
          const raw = await client.getLogs({
            address: DEPLOYMENT.sigmaStrategist,
            fromBlock: cursor,
            toBlock,
            event: actionExecutedEvent,
          });
          for (const log of raw) {
            try {
              const decoded = decodeEventLog({
                abi: strategistAbi,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName !== "ActionExecuted") continue;
              const args = decoded.args as unknown as {
                user: Address;
                agent: Address;
                action: number;
                rationale: string;
              };
              fetched.push({
                tx: log.transactionHash!,
                blockNumber: log.blockNumber!,
                user: args.user,
                agent: args.agent,
                action: Number(args.action),
                rationale: args.rationale,
              });
            } catch {
              // Ignore logs that do not match the deployed ABI.
            }
          }
          cursor = toBlock + 1n;
        }

        if (cancelled) return;
        nextBlock = latest + 1n;
        collected = [...collected, ...fetched];
        setLogs(
          [...collected].sort((a, b) =>
            a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1,
          ),
        );
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Unable to load agent actions");
        setLogs((current) => current ?? []);
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
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-border">
            <p className="eyebrow col-span-2">Block</p>
            <p className="eyebrow col-span-2">Action</p>
            <p className="eyebrow col-span-3">User</p>
            <p className="eyebrow col-span-5">Rationale</p>
          </div>
          {logs === null && <div className="px-5 py-6 text-muted">Loading…</div>}
          {error && (
            <div className="px-5 py-4 border-b border-border text-sm text-amber-300">
              Event log temporarily unavailable. Retrying automatically.
            </div>
          )}
          {logs?.length === 0 && !error && (
            <div className="px-5 py-6 text-muted">
              No actions yet — register a policy and run a Pilot tick to populate.
            </div>
          )}
          {logs?.map((l) => (
            <div
              key={l.tx}
              className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4 px-5 py-4 border-b border-border last:border-b-0 items-start"
            >
              <a
                href={`${EXPLORER}/tx/${l.tx}`}
                target="_blank"
                rel="noreferrer"
                className="md:col-span-2 font-mono text-sm text-muted hover:text-accent"
              >
                <span className="eyebrow md:hidden mr-2">Block</span>
                #{l.blockNumber.toString()}
              </a>
              <div className="md:col-span-2">
                <span className="eyebrow md:hidden mr-2">Action</span>
                <span className="font-mono text-sm border border-accent text-accent px-2 py-0.5">
                  {ACTION_LABEL[l.action] ?? `act ${l.action}`}
                </span>
              </div>
              <div className="md:col-span-3 font-mono text-sm">
                <span className="eyebrow md:hidden mr-2">User</span>
                {l.user.slice(0, 6)}…{l.user.slice(-4)}
              </div>
              <div className="md:col-span-5 text-sm text-muted leading-snug">
                <span className="eyebrow md:hidden block mb-1">Rationale</span>
                {l.rationale || <span className="italic">(empty)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
