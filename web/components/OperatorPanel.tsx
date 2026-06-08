"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { erc20Abi, strategistAbi, vaultAbi } from "@/lib/abis";
import { robinhoodTestnet } from "@/lib/chain";
import { DEPLOYMENT, EXPLORER } from "@/lib/contracts";
import { shortAddr, usd, wad } from "@/lib/format";
import { publicClient } from "@/lib/public-client";
import { useWallet } from "@/lib/wallet";

interface PolicySnapshot {
  agent: Address;
  maxBorrow6: bigint;
  maxStockShare: bigint;
  minHealthFactor: bigint;
  cooldownSec: bigint;
  active: boolean;
  executor: Address;
  strategistAllowance: bigint;
  debt: bigint;
  maxBorrowable: bigint;
  usdcBalance: bigint;
}

type BusyAction = "deposit" | "withdraw" | "borrow" | "repay" | "enable" | "revoke";

const inputClass =
  "mt-2 w-full border border-border bg-bg px-3 py-2 font-mono text-sm text-text outline-none transition-colors focus:border-accent";
const buttonClass =
  "w-full border border-accent px-4 py-2.5 font-mono text-sm text-accent transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent";

function positiveUnits(value: string, decimals: number, label: string): bigint {
  let parsed: bigint;
  try {
    parsed = parseUnits(value.trim(), decimals);
  } catch {
    throw new Error(`${label} must be a valid number`);
  }
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero`);
  return parsed;
}

function nonNegativeUnits(value: string, decimals: number, label: string): bigint {
  let parsed: bigint;
  try {
    parsed = parseUnits(value.trim(), decimals);
  } catch {
    throw new Error(`${label} must be a valid number`);
  }
  if (parsed < 0n) throw new Error(`${label} cannot be negative`);
  return parsed;
}

function messageFrom(cause: unknown): string {
  if (cause instanceof Error) {
    const detail = cause.message.split("\n")[0];
    if (detail.includes("User rejected") || detail.includes("user rejected")) {
      return "Transaction rejected in wallet";
    }
    return detail.replace(/^Error: /, "");
  }
  return "Transaction failed";
}

function trimDecimal(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function percentFromWad(value: bigint): string {
  return trimDecimal(formatUnits(value, 16));
}

function secondsLabel(value: bigint): string {
  if (value < 60n) return `${value}s`;
  const minutes = value / 60n;
  const seconds = value % 60n;
  return seconds === 0n ? `${minutes} min` : `${minutes}m ${seconds}s`;
}

export function OperatorPanel() {
  const { address, chainId, connect, isConnected, sendTransaction, switchToRobinhood } = useWallet();
  const [stock, setStock] = useState<Address>(DEPLOYMENT.stocks[0].address);
  const [stockAmount, setStockAmount] = useState("1");
  const [usdcAmount, setUsdcAmount] = useState("50");
  const [agent, setAgent] = useState<string>(DEPLOYMENT.pilotEoa);
  const [maxBorrow, setMaxBorrow] = useState("150");
  const [maxStockShare, setMaxStockShare] = useState("100");
  const [minHealth, setMinHealth] = useState("1.2");
  const [cooldownSeconds, setCooldownSeconds] = useState("5");
  const [snapshot, setSnapshot] = useState<PolicySnapshot>();
  const [busy, setBusy] = useState<BusyAction>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [lastHash, setLastHash] = useState<Hash>();

  const wrongChain = isConnected && chainId !== robinhoodTestnet.id;
  const selectedStock = useMemo(
    () => DEPLOYMENT.stocks.find((candidate) => candidate.address === stock) ?? DEPLOYMENT.stocks[0],
    [stock],
  );

  const load = useCallback(async () => {
    if (!address || chainId !== robinhoodTestnet.id) {
      setSnapshot(undefined);
      return;
    }
    const [policy, executor, strategistAllowance, debt, maxBorrowable, usdcBalance] = await Promise.all([
      publicClient.readContract({
        address: DEPLOYMENT.sigmaStrategist,
        abi: strategistAbi,
        functionName: "policyOf",
        args: [address],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.sigmaVault,
        abi: vaultAbi,
        functionName: "executor",
        args: [address],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, DEPLOYMENT.sigmaStrategist],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.sigmaVault,
        abi: vaultAbi,
        functionName: "debt",
        args: [address],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.sigmaVault,
        abi: vaultAbi,
        functionName: "maxBorrowable",
        args: [address],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);
    setSnapshot({
      agent: policy[0],
      maxBorrow6: policy[1],
      maxStockShare: policy[2],
      minHealthFactor: policy[3],
      cooldownSec: policy[4],
      active: policy[5],
      executor,
      strategistAllowance,
      debt,
      maxBorrowable,
      usdcBalance,
    });
  }, [address, chainId]);

  useEffect(() => {
    void load().catch(() => setSnapshot(undefined));
  }, [load]);

  useEffect(() => {
    if (!snapshot?.active) return;
    setAgent(snapshot.agent);
    setMaxBorrow(trimDecimal(formatUnits(snapshot.maxBorrow6, 6)));
    setMaxStockShare(percentFromWad(snapshot.maxStockShare));
    setMinHealth(trimDecimal(formatUnits(snapshot.minHealthFactor, 18)));
    setCooldownSeconds(snapshot.cooldownSec.toString());
  }, [snapshot]);

  async function submit(label: string, to: Address, data: Hex): Promise<Hash> {
    setStatus(`${label}: confirm in wallet`);
    const hash = await sendTransaction({ to, data });
    setLastHash(hash);
    setStatus(`${label}: waiting for confirmation`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
    if (receipt.status !== "success") throw new Error(`${label} reverted`);
    return hash;
  }

  async function approve(token: Address, spender: Address, amount: bigint, label: string) {
    if (!address) throw new Error("Connect a wallet first");
    const allowance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, spender],
    });
    if (allowance >= amount) return;
    await submit(
      label,
      token,
      encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
    );
  }

  async function setExactApproval(token: Address, spender: Address, current: bigint, target: bigint) {
    if (current === target) return;
    if (current > 0n) {
      await submit(
        "Reset Pilot repayment allowance",
        token,
        encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, 0n] }),
      );
    }
    if (target > 0n) {
      await submit(
        "Set Pilot repayment allowance",
        token,
        encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, target] }),
      );
    }
  }

  async function run(action: BusyAction, operation: () => Promise<void>) {
    if (!address) {
      await connect();
      return;
    }
    if (wrongChain) {
      await switchToRobinhood();
      return;
    }
    setBusy(action);
    setError(undefined);
    setLastHash(undefined);
    try {
      await operation();
      setStatus("Confirmed on Robinhood Chain testnet");
      await load();
    } catch (cause) {
      setStatus(undefined);
      setError(messageFrom(cause));
    } finally {
      await load().catch(() => undefined);
      setBusy(undefined);
    }
  }

  async function deposit() {
    if (!address) throw new Error("Connect a wallet first");
    const amount = positiveUnits(stockAmount, 18, "Stock amount");
    const balance = await publicClient.readContract({
      address: stock,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    if (amount > balance) throw new Error(`Insufficient ${selectedStock.symbol} wallet balance`);
    await approve(stock, DEPLOYMENT.sigmaVault, amount, `Approve ${selectedStock.symbol}`);
    await submit(
      `Deposit ${selectedStock.symbol}`,
      DEPLOYMENT.sigmaVault,
      encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [stock, amount] }),
    );
  }

  async function withdraw() {
    const amount = positiveUnits(stockAmount, 18, "Stock amount");
    await submit(
      `Withdraw ${selectedStock.symbol}`,
      DEPLOYMENT.sigmaVault,
      encodeFunctionData({ abi: vaultAbi, functionName: "withdraw", args: [stock, amount] }),
    );
  }

  async function borrow() {
    if (!snapshot) throw new Error("Position data is not available yet");
    const amount = positiveUnits(usdcAmount, 6, "USDC amount");
    const available = snapshot.maxBorrowable > snapshot.debt ? snapshot.maxBorrowable - snapshot.debt : 0n;
    if (amount > available) throw new Error(`Borrow exceeds available capacity of ${formatUnits(available, 6)} USDC`);
    await submit(
      "Borrow USDC",
      DEPLOYMENT.sigmaVault,
      encodeFunctionData({ abi: vaultAbi, functionName: "borrow", args: [amount] }),
    );
  }

  async function repay() {
    if (!address || !snapshot) throw new Error("Position data is not available yet");
    if (snapshot.debt === 0n) throw new Error("This position has no debt to repay");
    const requested = positiveUnits(usdcAmount, 6, "USDC amount");
    const amount = requested > snapshot.debt ? snapshot.debt : requested;
    if (amount > snapshot.usdcBalance) throw new Error("Insufficient USDC wallet balance");
    await approve(DEPLOYMENT.usdc, DEPLOYMENT.sigmaVault, amount, "Approve USDC repayment");
    await submit(
      "Repay USDC",
      DEPLOYMENT.sigmaVault,
      encodeFunctionData({ abi: vaultAbi, functionName: "repay", args: [amount] }),
    );
  }

  async function enablePilot() {
    if (!snapshot) throw new Error("Policy data is not available yet");
    if (!isAddress(agent)) throw new Error("Pilot agent must be a valid address");
    const maxBorrow6 = nonNegativeUnits(maxBorrow, 6, "Borrow cap");
    const maxStockShareWad = nonNegativeUnits(maxStockShare, 16, "Stock concentration limit");
    if (maxStockShareWad > 10n ** 18n) throw new Error("Stock concentration cannot exceed 100%");
    const minHealthWad = positiveUnits(minHealth, 18, "Minimum health factor");
    if (minHealthWad < 10n ** 18n) throw new Error("Minimum health factor cannot be below 1");
    const cooldown = Number.parseInt(cooldownSeconds, 10);
    if (!Number.isSafeInteger(cooldown) || cooldown < 0) {
      throw new Error("Cooldown must be a non-negative whole number of seconds");
    }
    const agentAddress = getAddress(agent);
    const repaymentAllowance = maxBorrow6 > snapshot.debt ? maxBorrow6 : snapshot.debt;

    // Keep the agent inactive until every supporting permission is ready. If
    // the user rejects a later transaction, the partial sequence fails closed.
    if (snapshot.active) {
      await submit(
        "Pause existing Pilot policy",
        DEPLOYMENT.sigmaStrategist,
        encodeFunctionData({ abi: strategistAbi, functionName: "deactivate" }),
      );
    }
    await setExactApproval(
      DEPLOYMENT.usdc,
      DEPLOYMENT.sigmaStrategist,
      snapshot.strategistAllowance,
      repaymentAllowance,
    );
    if (snapshot.executor !== DEPLOYMENT.sigmaStrategist) {
      await submit(
        "Authorize Sigma Strategist",
        DEPLOYMENT.sigmaVault,
        encodeFunctionData({
          abi: vaultAbi,
          functionName: "setExecutor",
          args: [DEPLOYMENT.sigmaStrategist],
        }),
      );
    }
    await submit(
      "Register Pilot policy",
      DEPLOYMENT.sigmaStrategist,
      encodeFunctionData({
        abi: strategistAbi,
        functionName: "register",
        args: [
          {
            agent: agentAddress,
            maxBorrow6,
            maxStockShare: maxStockShareWad,
            minHealthFactor: minHealthWad,
            cooldownSec: BigInt(cooldown),
            active: true,
          },
        ],
      }),
    );
  }

  async function revokePilot() {
    if (!snapshot) throw new Error("Policy data is not available yet");
    if (snapshot.active) {
      await submit(
        "Deactivate Pilot policy",
        DEPLOYMENT.sigmaStrategist,
        encodeFunctionData({ abi: strategistAbi, functionName: "deactivate" }),
      );
    }
    if (snapshot.executor === DEPLOYMENT.sigmaStrategist) {
      await submit(
        "Revoke Strategist executor",
        DEPLOYMENT.sigmaVault,
        encodeFunctionData({ abi: vaultAbi, functionName: "setExecutor", args: [zeroAddress] }),
      );
    }
    await setExactApproval(
      DEPLOYMENT.usdc,
      DEPLOYMENT.sigmaStrategist,
      snapshot.strategistAllowance,
      0n,
    );
  }

  const actionLabel = !isConnected ? "Connect wallet" : wrongChain ? "Switch network" : undefined;
  const hasPilotPermissions = snapshot !== undefined && (
    snapshot.active ||
    snapshot.executor === DEPLOYMENT.sigmaStrategist ||
    snapshot.strategistAllowance > 0n
  );

  return (
    <section id="operate" className="border-b border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-3">Operate · self-custodial</p>
            <h2>Manage the position from your wallet.</h2>
          </div>
          <div className="col-span-12 md:col-span-5 text-muted">
            Direct actions call the Vault. Pilot setup separately grants the Strategist bounded
            executor access and a repayment allowance. Every step is confirmed in your wallet.
          </div>
        </div>

        {(status || error || lastHash) && (
          <div className={`mb-6 border px-4 py-3 font-mono text-sm ${error ? "border-red-400/40 bg-red-400/10 text-red-200" : "border-accent/40 bg-accent-dim text-text"}`}>
            {error ?? status}
            {lastHash && (
              <a
                href={`${EXPLORER}/tx/${lastHash}`}
                target="_blank"
                rel="noreferrer"
                className="ml-3 text-accent underline underline-offset-4"
              >
                view transaction
              </a>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="mb-6 border border-border bg-bg px-4 py-3 text-sm text-muted">
            Connect an injected wallet to operate. Until then, the portfolio above continues to show the public demo position.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel p-5 md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Vault actions</p>
                <h3>Deposit, borrow, and repay.</h3>
              </div>
              {snapshot && (
                <div className="text-right font-mono text-xs text-muted">
                  <div>debt {usd(snapshot.debt)}</div>
                  <div>capacity {usd(snapshot.maxBorrowable)}</div>
                  <div>USDC {formatUnits(snapshot.usdcBalance, 6)}</div>
                </div>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="eyebrow">
                Tokenized stock
                <select value={stock} onChange={(event) => setStock(event.target.value as Address)} className={inputClass}>
                  {DEPLOYMENT.stocks.map((candidate) => (
                    <option key={candidate.address} value={candidate.address}>{candidate.symbol}</option>
                  ))}
                </select>
              </label>
              <label className="eyebrow">
                Stock quantity
                <input value={stockAmount} onChange={(event) => setStockAmount(event.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <button disabled={busy !== undefined} onClick={() => void run("deposit", deposit)} className={buttonClass}>
                {actionLabel ?? (busy === "deposit" ? "Processing…" : `Deposit ${selectedStock.symbol}`)}
              </button>
              <button disabled={busy !== undefined} onClick={() => void run("withdraw", withdraw)} className={buttonClass}>
                {actionLabel ?? (busy === "withdraw" ? "Processing…" : `Withdraw ${selectedStock.symbol}`)}
              </button>
            </div>

            <div className="my-6 border-t border-border" />

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="eyebrow sm:col-span-2">
                USDC amount
                <input value={usdcAmount} onChange={(event) => setUsdcAmount(event.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <button disabled={busy !== undefined} onClick={() => void run("borrow", borrow)} className={buttonClass}>
                {actionLabel ?? (busy === "borrow" ? "Processing…" : "Borrow USDC")}
              </button>
              <button disabled={busy !== undefined} onClick={() => void run("repay", repay)} className={buttonClass}>
                {actionLabel ?? (busy === "repay" ? "Processing…" : "Repay USDC")}
              </button>
            </div>
            <p className="mt-5 text-sm text-muted">
              Withdrawal and borrowing revert on-chain if the resulting position would be unhealthy.
            </p>
          </div>

          <div className="panel p-5 md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Sigma Pilot policy</p>
                <h3>Bound autonomous actions on-chain.</h3>
              </div>
              <span className={`border px-2 py-1 font-mono text-xs ${snapshot?.active ? "border-accent text-accent" : "border-border text-muted"}`}>
                {snapshot?.active ? "active" : "inactive"}
              </span>
            </div>

            {snapshot?.active && (
              <div className="mb-6 grid grid-cols-2 gap-px border border-border bg-border text-sm">
                <PolicyValue label="Agent" value={shortAddr(snapshot.agent)} />
                <PolicyValue label="Borrow cap" value={usd(snapshot.maxBorrow6)} />
                <PolicyValue label="Max stock" value={`${percentFromWad(snapshot.maxStockShare)}%`} />
                <PolicyValue label="Min health" value={wad(snapshot.minHealthFactor, 2)} />
                <PolicyValue label="Cooldown" value={secondsLabel(snapshot.cooldownSec)} />
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="eyebrow sm:col-span-2">
                Authorized agent
                <input value={agent} onChange={(event) => setAgent(event.target.value)} spellCheck={false} className={inputClass} />
              </label>
              <label className="eyebrow">
                Borrow cap · USDC
                <input value={maxBorrow} onChange={(event) => setMaxBorrow(event.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="eyebrow">
                Max one-stock share · %
                <input value={maxStockShare} onChange={(event) => setMaxStockShare(event.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="eyebrow">
                Minimum health factor
                <input value={minHealth} onChange={(event) => setMinHealth(event.target.value)} inputMode="decimal" className={inputClass} />
              </label>
              <label className="eyebrow">
                Cooldown · seconds
                <input value={cooldownSeconds} onChange={(event) => setCooldownSeconds(event.target.value)} inputMode="numeric" className={inputClass} />
              </label>
              <button disabled={busy !== undefined} onClick={() => void run("enable", enablePilot)} className={buttonClass}>
                {actionLabel ?? (busy === "enable" ? "Processing…" : snapshot?.active ? "Update Pilot policy" : "Enable Pilot")}
              </button>
              <button disabled={busy !== undefined || (snapshot !== undefined && !hasPilotPermissions)} onClick={() => void run("revoke", revokePilot)} className={`${buttonClass} border-red-400 text-red-300 hover:bg-red-400/10`}>
                {actionLabel ?? (busy === "revoke" ? "Processing…" : "Revoke Pilot")}
              </button>
            </div>

            <p className="mt-5 text-sm text-muted">
              Enabling may require several confirmations. Sigma sets the bounded USDC repayment allowance
              and executor first, then activates the policy last. Revocation removes all three permissions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-3">
      <p className="eyebrow mb-1">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}
