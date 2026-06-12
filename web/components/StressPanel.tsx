"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { DEPLOYMENT } from "@/lib/contracts";
import { sigmaCoreAbi, strategistAbi, vaultAbi, oracleAbi } from "@/lib/abis";
import { usd, wad } from "@/lib/format";
import { publicClient } from "@/lib/public-client";
import { useWallet } from "@/lib/wallet";

const WAD = 10n ** 18n;

interface Scenario {
  label: string;
  priceMulWad?: (symbol: string) => bigint;
  volMulWad?: bigint;
  corrOverrideWad?: bigint;
}

const SCENARIOS: Scenario[] = [
  { label: "Live market" },
  { label: "TSLA −20%", priceMulWad: (s) => (s === "TSLA" ? (WAD * 80n) / 100n : WAD) },
  { label: "All stocks −15%", priceMulWad: () => (WAD * 85n) / 100n },
  { label: "Volatility ×2", volMulWad: 2n * WAD },
  { label: "Correlations → 0.9", corrOverrideWad: (WAD * 90n) / 100n },
];

interface ScenarioRow {
  label: string;
  pv6: bigint;
  var6: bigint;
  maxBorrow6: bigint;
  health: bigint | undefined; // undefined when there is no debt
  verdict: string;
  breach: boolean;
}

interface BasketState {
  amounts: bigint[];
  prices: bigint[];
  vols: bigint[];
  corrPacked: bigint[];
  pairs: Array<[number, number]>;
  zScore: bigint;
  horizonSqrt: bigint;
  varSafetyFactor: bigint;
  maxLtvWad: bigint;
  debt: bigint;
  minHealthFactor?: bigint; // set only when a policy is active
}

async function loadBasket(user: Address): Promise<BasketState> {
  const stocks = DEPLOYMENT.stocks;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < stocks.length; i++) {
    for (let j = i; j < stocks.length; j++) pairs.push([i, j]);
  }

  const vaultRead = (functionName: "zScore" | "horizonSqrt" | "varSafetyFactor" | "maxLtvWad") =>
    publicClient.readContract({ address: DEPLOYMENT.sigmaVault, abi: vaultAbi, functionName });

  const [amounts, prices, vols, corrPacked, zScore, horizonSqrt, varSafetyFactor, maxLtvWad, debt, policy] =
    await Promise.all([
      Promise.all(
        stocks.map((s) =>
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "collateral",
            args: [user, s.address],
          }),
        ),
      ),
      Promise.all(
        stocks.map((s) =>
          publicClient.readContract({
            address: DEPLOYMENT.oracleAdapter,
            abi: oracleAbi,
            functionName: "getPrice",
            args: [s.address],
          }),
        ),
      ),
      Promise.all(
        stocks.map((s) =>
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "vol",
            args: [s.address],
          }),
        ),
      ),
      Promise.all(
        pairs.map(([i, j]) =>
          publicClient.readContract({
            address: DEPLOYMENT.sigmaVault,
            abi: vaultAbi,
            functionName: "corr",
            args: [stocks[i].address, stocks[j].address],
          }),
        ),
      ),
      vaultRead("zScore"),
      vaultRead("horizonSqrt"),
      vaultRead("varSafetyFactor"),
      vaultRead("maxLtvWad"),
      publicClient.readContract({
        address: DEPLOYMENT.sigmaVault,
        abi: vaultAbi,
        functionName: "debt",
        args: [user],
      }),
      publicClient.readContract({
        address: DEPLOYMENT.sigmaStrategist,
        abi: strategistAbi,
        functionName: "policyOf",
        args: [user],
      }),
    ]);

  return {
    amounts,
    prices,
    vols,
    corrPacked,
    pairs,
    zScore,
    horizonSqrt,
    varSafetyFactor,
    maxLtvWad,
    debt,
    minHealthFactor: policy[5] ? policy[3] : undefined,
  };
}

async function runScenario(basket: BasketState, scenario: Scenario): Promise<ScenarioRow> {
  const stocks = DEPLOYMENT.stocks;
  const prices = basket.prices.map((p, i) =>
    scenario.priceMulWad ? (p * scenario.priceMulWad(stocks[i].symbol)) / WAD : p,
  );
  const value6 = basket.amounts.map((amt, i) => (amt * prices[i]) / 10n ** 30n);
  const pv6 = value6.reduce((acc, v) => acc + v, 0n);

  // Same input construction as SigmaVault.computeVaR, with shocked values.
  const weights = value6.map((v) => (pv6 === 0n ? 0n : (v * WAD) / pv6));
  const vols = basket.vols.map((v) => (scenario.volMulWad ? (v * scenario.volMulWad) / WAD : v));
  const corr = basket.corrPacked.map((c, k) => {
    const [i, j] = basket.pairs[k];
    if (i === j || scenario.corrOverrideWad === undefined) return c;
    return scenario.corrOverrideWad;
  });

  const var6 =
    pv6 === 0n
      ? 0n
      : await publicClient.readContract({
          address: DEPLOYMENT.sigmaCore,
          abi: sigmaCoreAbi,
          functionName: "computePortfolioVar",
          args: [weights, vols, corr, pv6, basket.zScore, basket.horizonSqrt],
        });

  const safety6 = (var6 * basket.varSafetyFactor) / WAD;
  const varBound = pv6 > safety6 ? pv6 - safety6 : 0n;
  const ltvBound = (pv6 * basket.maxLtvWad) / WAD;
  const maxBorrow6 = varBound < ltvBound ? varBound : ltvBound;
  const health = basket.debt === 0n ? undefined : (maxBorrow6 * WAD) / basket.debt;

  let verdict: string;
  let breach = false;
  if (health === undefined) {
    verdict = "no debt · Pilot idle";
  } else if (health < WAD) {
    verdict = "insolvent threshold · guardian repays now";
    breach = true;
  } else if (basket.minHealthFactor !== undefined && health < basket.minHealthFactor) {
    verdict = "below policy floor · guardian repays";
    breach = true;
  } else {
    verdict = "within policy · Pilot holds";
  }

  return { label: scenario.label, pv6, var6, maxBorrow6, health, verdict, breach };
}

export function StressPanel() {
  const { address } = useWallet();
  const user = address ?? DEPLOYMENT.demoUser;
  const [rows, setRows] = useState<ScenarioRow[] | null>(null);
  const [minHealth, setMinHealth] = useState<bigint>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const basket = await loadBasket(user);
        const computed = await Promise.all(SCENARIOS.map((s) => runScenario(basket, s)));
        if (cancelled) return;
        setRows(computed);
        setMinHealth(basket.minHealthFactor);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    setRows(null);
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  return (
    <section id="stress" className="border-b border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-12 gap-6 items-end mb-8">
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-3">Stress lab · scenario VaR</p>
            <h2>What happens when the market turns.</h2>
          </div>
          <div className="col-span-12 md:col-span-5 text-muted">
            Each scenario shocks the live collateral basket and sends the result to the
            deployed Stylus core — <span className="font-mono text-text text-sm">computePortfolioVar</span>{" "}
            on-chain does the math, not the browser.
            {minHealth !== undefined && (
              <> The active Pilot policy floors health at <span className="font-mono text-text text-sm">{wad(minHealth, 2)}</span>.</>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Scenario reads failed. Retrying automatically.
          </div>
        )}

        <div className="panel">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-border">
            <p className="eyebrow col-span-3">Scenario</p>
            <p className="eyebrow col-span-2 text-right">Portfolio value</p>
            <p className="eyebrow col-span-2 text-right">VaR · 1d 95%</p>
            <p className="eyebrow col-span-2 text-right">Max borrowable</p>
            <p className="eyebrow col-span-1 text-right">Health</p>
            <p className="eyebrow col-span-2 text-right">Pilot response</p>
          </div>
          {rows === null && !error && <div className="px-5 py-6 text-muted">Computing scenarios on-chain…</div>}
          {rows?.map((row, index) => (
            <div
              key={row.label}
              className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4 px-5 py-4 border-b border-border last:border-b-0 items-center"
            >
              <div className="col-span-2 md:col-span-3 font-mono text-sm">
                {index === 0 ? <span className="text-accent">{row.label}</span> : row.label}
              </div>
              <div className="md:col-span-2 md:text-right font-mono text-sm">
                <span className="eyebrow block md:hidden">Portfolio value</span>
                {usd(row.pv6)}
              </div>
              <div className="md:col-span-2 text-right font-mono text-sm">
                <span className="eyebrow block md:hidden">VaR</span>
                {usd(row.var6)}
              </div>
              <div className="md:col-span-2 text-right font-mono text-sm">
                <span className="eyebrow block md:hidden">Max borrowable</span>
                {usd(row.maxBorrow6)}
              </div>
              <div className="md:col-span-1 text-right font-mono text-sm">
                <span className="eyebrow block md:hidden">Health</span>
                {row.health === undefined ? "∞" : wad(row.health, 2)}
              </div>
              <div className={`col-span-2 md:col-span-2 md:text-right text-sm ${row.breach ? "text-amber-300" : "text-muted"}`}>
                {row.verdict}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
