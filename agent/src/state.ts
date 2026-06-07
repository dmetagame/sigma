import { formatUnits, type Address } from "viem";
import { env } from "./config.js";
import { makePublicClient } from "./client.js";
import { vaultAbi, oracleAbi, erc20Abi, strategistAbi } from "./abi.js";

export interface Position {
  stock: Address;
  symbol: string;
  amount: bigint; // 18-dec stock token units
  priceWad: bigint; // 1e18-scaled USDC per token
  value6: bigint; // USDC 6-dec value
  shareWad: bigint; // WAD weight in portfolio
  vol: bigint; // WAD annualized volatility (read from Vault state)
}

export interface PortfolioState {
  user: Address;
  positions: Position[];
  portfolioValue6: bigint;
  debt6: bigint;
  varUsd6: bigint;
  maxBorrowable6: bigint;
  healthWad: bigint; // WAD; >1e18 = healthy, type(uint256).max = no debt
  pilotEoa: Address;
  policy: {
    agent: Address;
    maxBorrow6: bigint;
    maxStockShareWad: bigint;
    minHealthFactorWad: bigint;
    cooldownSec: bigint;
    lastActionAt: bigint;
    active: boolean;
  };
  usdcBalance6: bigint;
  strategistAllowance6: bigint;
  chainTimestamp: bigint;
}

const usdcFmt = (x: bigint) => `$${formatUnits(x, 6)}`;
const wadFmt = (x: bigint) =>
  x === (1n << 256n) - 1n ? "∞" : (Number(x) / 1e18).toFixed(4);

/**
 * Read the full portfolio state for `user`. Single-batch where possible.
 */
export async function readPortfolioState(
  user: Address,
  pilot: Address,
): Promise<PortfolioState> {
  const pc = makePublicClient();
  const vault = env.SIGMA_VAULT_ADDR as Address;
  if (!vault) throw new Error("SIGMA_VAULT_ADDR is not set in .env.local");
  const strategist = env.SIGMA_STRATEGIST_ADDR as Address;
  if (!strategist) throw new Error("SIGMA_STRATEGIST_ADDR is not set in .env.local");
  const usdc = env.USDC_ADDR as Address;
  if (!usdc) throw new Error("USDC_ADDR is not set in .env.local");

  const stocks = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "supportedStocks",
  })) as readonly Address[];

  const oracle = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "oracle",
  })) as Address;

  const portfolioValue6 = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "portfolioValue",
    args: [user],
  })) as bigint;

  const debt6 = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "debt",
    args: [user],
  })) as bigint;

  const varUsd6 = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "computeVaR",
    args: [user],
  })) as bigint;

  const maxBorrowable6 = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "maxBorrowable",
    args: [user],
  })) as bigint;

  const healthWad = (await pc.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "health",
    args: [user],
  })) as bigint;

  const [policyRaw, lastActionAt, usdcBalance6, strategistAllowance6, block] =
    await Promise.all([
      pc.readContract({
        address: strategist,
        abi: strategistAbi,
        functionName: "policyOf",
        args: [user],
      }),
      pc.readContract({
        address: strategist,
        abi: strategistAbi,
        functionName: "lastActionAt",
        args: [user],
      }),
      pc.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [user],
      }),
      pc.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, strategist],
      }),
      pc.getBlock(),
    ]);

  const [agent, maxBorrow6, maxStockShareWad, minHealthFactorWad, cooldownSec, active] =
    policyRaw;

  const positions: Position[] = [];
  for (const stock of stocks) {
    const amount = (await pc.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "collateral",
      args: [user, stock],
    })) as bigint;
    if (amount === 0n) continue;
    const priceWad = (await pc.readContract({
      address: oracle,
      abi: oracleAbi,
      functionName: "getPrice",
      args: [stock],
    })) as bigint;
    const symbol = (await pc.readContract({
      address: stock,
      abi: erc20Abi,
      functionName: "symbol",
    })) as string;
    const value6 = (amount * priceWad) / 10n ** 30n;
    const shareWad =
      portfolioValue6 === 0n ? 0n : (value6 * 10n ** 18n) / portfolioValue6;
    // We don't read per-stock vol off-chain here; the agent doesn't need it for
    // most decisions (the Vault uses it internally). If needed, expose a getter.
    positions.push({
      stock,
      symbol,
      amount,
      priceWad,
      value6,
      shareWad,
      vol: 0n,
    });
  }

  return {
    user,
    positions,
    portfolioValue6,
    debt6,
    varUsd6,
    maxBorrowable6,
    healthWad,
    pilotEoa: pilot,
    policy: {
      agent,
      maxBorrow6,
      maxStockShareWad,
      minHealthFactorWad,
      cooldownSec,
      lastActionAt,
      active,
    },
    usdcBalance6,
    strategistAllowance6,
    chainTimestamp: block.timestamp,
  };
}

export function summarize(state: PortfolioState): string {
  const lines: string[] = [];
  lines.push(`Portfolio for ${state.user}`);
  lines.push(`  Value:       ${usdcFmt(state.portfolioValue6)}`);
  lines.push(`  Debt:        ${usdcFmt(state.debt6)}`);
  lines.push(`  VaR (1d 95%):${usdcFmt(state.varUsd6)}`);
  lines.push(`  Max borrow:  ${usdcFmt(state.maxBorrowable6)}`);
  lines.push(`  Health:      ${wadFmt(state.healthWad)}`);
  const cooldownEnds = state.policy.lastActionAt + state.policy.cooldownSec;
  const cooldownRemaining =
    cooldownEnds > state.chainTimestamp ? cooldownEnds - state.chainTimestamp : 0n;
  lines.push(
    `  Policy:      active=${state.policy.active} agent=${state.policy.agent} maxDebt=${usdcFmt(state.policy.maxBorrow6)} minHealth=${wadFmt(state.policy.minHealthFactorWad)} maxStockShare=${wadFmt(state.policy.maxStockShareWad)} cooldownRemaining=${cooldownRemaining}s`,
  );
  lines.push(
    `  Repay funds: balance=${usdcFmt(state.usdcBalance6)} strategistAllowance=${usdcFmt(state.strategistAllowance6)}`,
  );
  lines.push(`  Positions:`);
  for (const p of state.positions) {
    lines.push(
      `    ${p.symbol.padEnd(8)} amt=${formatUnits(p.amount, 18)} px=$${formatUnits(p.priceWad, 18)} value=${usdcFmt(p.value6)} share=${wadFmt(p.shareWad)}`,
    );
  }
  return lines.join("\n");
}
