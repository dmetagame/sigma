"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { DEPLOYMENT } from "@/lib/contracts";
import { vaultAbi, oracleAbi, erc20Abi } from "@/lib/abis";
import { usd, num, wad } from "@/lib/format";
import { publicClient } from "@/lib/public-client";
import { useWallet } from "@/lib/wallet";

interface PositionRow {
  symbol: string;
  address: Address;
  amount?: bigint;
  priceWad?: bigint;
  value6?: bigint;
  walletBal?: bigint;
}

interface PortfolioSnapshot {
  portfolioValue?: bigint;
  debt?: bigint;
  varUsd?: bigint;
  maxBorrow?: bigint;
  health?: bigint;
  positions: PositionRow[];
}

const emptyPositions = () => DEPLOYMENT.stocks.map((stock) => ({ ...stock }));

export function PortfolioPanel() {
  const { address } = useWallet();
  const user = address ?? DEPLOYMENT.demoUser;
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot>({ positions: emptyPositions() });
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [portfolioValue, debt, varUsd, maxBorrow, health, positions] = await Promise.all([
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "portfolioValue",
            args: [user],
          }),
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "debt",
            args: [user],
          }),
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "computeVaR",
            args: [user],
          }),
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "maxBorrowable",
            args: [user],
          }),
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "health",
            args: [user],
          }),
          Promise.all(
            DEPLOYMENT.stocks.map(async (stock) => {
              const [amount, priceWad, walletBal] = await Promise.all([
                publicClient.readContract({
                  address: DEPLOYMENT.sigmaVault,
                  abi: vaultAbi,
                  functionName: "collateral",
                  args: [user, stock.address],
                }),
                publicClient.readContract({
                  address: DEPLOYMENT.oracleAdapter,
                  abi: oracleAbi,
                  functionName: "getPrice",
                  args: [stock.address],
                }),
                publicClient.readContract({
                  address: stock.address,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [user],
                }),
              ]);
              return {
                ...stock,
                amount,
                priceWad,
                walletBal,
                value6: (amount * priceWad) / 10n ** 30n,
              };
            }),
          ),
        ]);
        if (cancelled) return;
        setSnapshot({
          portfolioValue,
          debt,
          varUsd,
          maxBorrow,
          health,
          positions,
        });
        setReadError(false);
      } catch {
        if (!cancelled) setReadError(true);
      }
    }

    setSnapshot({ positions: emptyPositions() });
    load();
    const id = setInterval(load, 6_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  return (
    <section id="portfolio" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-12 gap-6 items-end mb-8">
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-3">Portfolio · {user.slice(0, 6)}…{user.slice(-4)}</p>
            <h2>Live position on Robinhood Chain.</h2>
          </div>
          <div className="col-span-12 md:col-span-5 text-muted">
            Every number below is read directly from the deployed contracts every
            6 seconds via viem. A dedicated reporter publishes prices only after Pyth
            and RedStone agree within 2%; this remains a testnet trust model.
          </div>
        </div>

        {readError && (
          <div className="mb-4 border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Some contract reads failed. Displayed placeholders are not position values.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border">
          <Stat label="Portfolio value" value={usd(snapshot.portfolioValue)} accent />
          <Stat label="Debt" value={usd(snapshot.debt)} />
          <Stat
            label="VaR · 1d 95%"
            value={usd(snapshot.varUsd)}
            sub="from sigma core (stylus)"
          />
          <Stat label="Max borrowable" value={usd(snapshot.maxBorrow)} />
          <Stat label="Health factor" value={wad(snapshot.health, 2)} sub="≥ 1 = solvent" />
        </div>

        <div className="mt-10 panel">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-border">
            <p className="eyebrow col-span-3">Asset</p>
            <p className="eyebrow col-span-2 text-right">Vault qty</p>
            <p className="eyebrow col-span-2 text-right">Wallet qty</p>
            <p className="eyebrow col-span-2 text-right">Price</p>
            <p className="eyebrow col-span-3 text-right">Value</p>
          </div>
          {snapshot.positions.map((p) => (
            <div
              key={p.address}
              className="grid grid-cols-2 gap-4 md:grid-cols-12 px-5 py-4 border-b border-border last:border-b-0 items-center"
            >
              <div className="col-span-2 md:col-span-3 flex items-center gap-3">
                <span className="font-display text-xl">{p.symbol}</span>
                <span className="font-mono text-xs text-muted hidden md:inline">
                  {p.address.slice(0, 6)}…{p.address.slice(-4)}
                </span>
              </div>
              <div className="md:col-span-2 md:text-right font-mono">
                <span className="eyebrow block md:hidden">Vault qty</span>
                {num(p.amount)}
              </div>
              <div className="md:col-span-2 text-right font-mono text-muted">
                <span className="eyebrow block md:hidden">Wallet qty</span>
                {num(p.walletBal)}
              </div>
              <div className="md:col-span-2 md:text-right font-mono">
                <span className="eyebrow block md:hidden">Oracle price</span>
                {usd(p.priceWad, 18)}
              </div>
              <div className="md:col-span-3 text-right font-mono">
                <span className="eyebrow block md:hidden">Value</span>
                {p.value6 !== undefined && p.value6 > 0n ? (
                  <span className="text-accent">{usd(p.value6)}</span>
                ) : (
                  <span className="text-muted">{usd(0n)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg p-5 last:sm:col-span-2 last:md:col-span-1">
      <p className="eyebrow mb-3">{label}</p>
      <p
        className={`font-mono text-2xl md:text-3xl tracking-tight ${
          accent ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </p>
      {sub && <p className="eyebrow mt-2">{sub}</p>}
    </div>
  );
}
