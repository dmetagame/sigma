// Mock market-regime signal source. In a real system this would hit:
// - news sentiment (Polygon.io / NewsAPI / curated wire)
// - on-chain volume + funding-rate features
// - implied vol surfaces from options venues
//
// For the hackathon demo we stub it with a deterministic-but-time-varying
// signal so the agent has *something* to reason about beyond pure on-chain.

export interface MarketRegime {
  regime: "calm" | "volatile" | "stressed";
  visScore: number; // -1..+1; positive = bullish
  reasoning: string;
}

const REGIMES: MarketRegime[] = [
  {
    regime: "calm",
    visScore: 0.2,
    reasoning:
      "Implied vol within 25th percentile, no scheduled earnings, breadth healthy.",
  },
  {
    regime: "volatile",
    visScore: -0.3,
    reasoning:
      "VIX up 15% week-over-week, AAPL guidance miss, credit spreads widening modestly.",
  },
  {
    regime: "stressed",
    visScore: -0.6,
    reasoning:
      "TSLA recall headline + macro CPI surprise. Multi-asset correlation spiking, intraday gap risk elevated.",
  },
];

/**
 * Optional override: if `MARKET_REGIME` env var is set to calm|volatile|stressed,
 * return that. Otherwise rotate by hour-of-day so the demo is reproducible.
 */
export function readMarketRegime(): MarketRegime {
  const override = process.env.MARKET_REGIME?.toLowerCase();
  const found = REGIMES.find((r) => r.regime === override);
  if (found) return found;
  const idx = new Date().getUTCHours() % REGIMES.length;
  return REGIMES[idx]!;
}
