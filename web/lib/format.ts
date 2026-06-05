import { formatUnits } from "viem";

const MAX_UINT256 = (1n << 256n) - 1n;

export function usd(x: bigint | undefined, decimals = 6): string {
  if (x === undefined) return "—";
  const n = Number(formatUnits(x, decimals));
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function num(x: bigint | undefined, decimals = 18, digits = 4): string {
  if (x === undefined) return "—";
  const n = Number(formatUnits(x, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function wad(x: bigint | undefined, digits = 3): string {
  if (x === undefined) return "—";
  if (x === MAX_UINT256) return "∞";
  const n = Number(x) / 1e18;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function pct(x: bigint | undefined, digits = 1): string {
  if (x === undefined) return "—";
  const n = (Number(x) / 1e18) * 100;
  return `${n.toFixed(digits)}%`;
}

export function shortAddr(a: string | undefined): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
