export interface GuardianState {
  debt6: bigint;
  maxBorrowable6: bigint;
  healthWad: bigint;
  pilotEoa: string;
  policy: {
    agent: string;
    minHealthFactorWad: bigint;
    active: boolean;
  };
  usdcBalance6: bigint;
  strategistAllowance6: bigint;
}

export interface GuardianPlan {
  amount6: bigint;
  reason: string;
}

const WAD = 10n ** 18n;

/// Deleverage 2% past the policy minimum so a small adverse price move does
/// not immediately re-trigger the guardian on the next scheduled run.
const RETARGET_BUFFER_WAD = 1_020_000_000_000_000_000n;

export function planDefensiveRepay(state: GuardianState): GuardianPlan | null {
  if (!state.policy.active) return null;
  if (state.policy.agent.toLowerCase() !== state.pilotEoa.toLowerCase()) return null;
  if (state.debt6 === 0n || state.healthWad >= state.policy.minHealthFactorWad) return null;

  const available = min(state.debt6, state.usdcBalance6, state.strategistAllowance6);
  if (available === 0n) return null;

  const bufferedMinHealth = (state.policy.minHealthFactorWad * RETARGET_BUFFER_WAD) / WAD;
  const targetDebt = (state.maxBorrowable6 * WAD) / bufferedMinHealth;
  const required = state.debt6 > targetDebt ? state.debt6 - targetDebt : 0n;
  const amount6 = min(required, available);
  if (amount6 === 0n) return null;

  return {
    amount6,
    reason: `Defensive guardian: health ${state.healthWad} is below policy minimum ${state.policy.minHealthFactorWad}; repay ${amount6} USDC-6 toward target debt ${targetDebt}.`,
  };
}

function min(...values: bigint[]): bigint {
  return values.reduce((smallest, value) => (value < smallest ? value : smallest));
}
