import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";
import { planDefensiveRepay } from "./guardian-plan.js";
import type { PortfolioState } from "./state.js";

const user = "0x0000000000000000000000000000000000000001" as Address;
const pilot = "0x0000000000000000000000000000000000000002" as Address;

function state(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return {
    user,
    positions: [],
    portfolioValue6: 200_000_000n,
    debt6: 150_000_000n,
    varUsd6: 10_000_000n,
    maxBorrowable6: 120_000_000n,
    healthWad: 800_000_000_000_000_000n,
    pilotEoa: pilot,
    policy: {
      agent: pilot,
      maxBorrow6: 150_000_000n,
      maxStockShareWad: 10n ** 18n,
      minHealthFactorWad: 1_200_000_000_000_000_000n,
      cooldownSec: 3600n,
      lastActionAt: 0n,
      active: true,
    },
    usdcBalance6: 100_000_000n,
    strategistAllowance6: 100_000_000n,
    chainTimestamp: 0n,
    ...overrides,
  };
}

test("plans the repayment needed to restore policy health plus a 2% buffer", () => {
  // target debt = maxBorrowable / (minHF · 1.02) = 120e6 / 1.224 = 98_039_215
  const plan = planDefensiveRepay(state());
  assert.equal(plan?.amount6, 150_000_000n - 98_039_215n);
});

test("uses available funds for partial deleveraging", () => {
  const plan = planDefensiveRepay(state({ usdcBalance6: 10_000_000n }));
  assert.equal(plan?.amount6, 10_000_000n);
});

test("passes when healthy or policy authorization is absent", () => {
  assert.equal(planDefensiveRepay(state({ healthWad: 2n * 10n ** 18n })), null);
  assert.equal(
    planDefensiveRepay(
      state({ policy: { ...state().policy, active: false } }),
    ),
    null,
  );
});
