//! Sigma Core — parametric portfolio VaR on Stylus.
//!
//! All amounts use WAD fixed-point (1e18 = 1.0) for ratios/volatilities/correlations,
//! and 6-decimal "USDC units" for monetary values, matching common DeFi conventions.
//!
//! VaR (one-sided, parametric Gaussian):
//!     σ_p² = Σ_i Σ_j wᵢ wⱼ σᵢ σⱼ ρᵢⱼ
//!     VaR  = V · z · σ_p · √t
//!
//! Where V is portfolio value, z is the critical z-score (e.g. 1.645 for 95%),
//! and √t is √(horizon in years).

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{I256, U256},
    prelude::*,
};

/// 1e18 — fixed-point unit.
const WAD: u64 = 1_000_000_000_000_000_000;

sol_storage! {
    #[entrypoint]
    pub struct SigmaCore {
        // No persistent state — VaR is computed as a pure function.
        // Stylus requires a non-empty storage block; we keep one accumulator
        // for last-result observability, but the main path does not write it.
        uint256 last_var;
    }
}

#[public]
impl SigmaCore {
    /// Compute parametric portfolio VaR.
    ///
    /// Inputs (lengths must satisfy: weights.len() == vols.len() == n,
    /// corr_packed.len() == n·(n+1)/2):
    ///
    /// - `weights[i]`      portfolio weight on asset i, WAD-scaled, ∈ [0, WAD].
    /// - `vols[i]`         annualized volatility of asset i, WAD-scaled.
    /// - `corr_packed[k]`  packed upper-triangular correlation matrix incl. diagonal,
    ///                     I256 WAD-scaled, ∈ [-WAD, WAD].
    ///                     Index: idx(i,j) = i·(2n-i+1)/2 + (j-i) for i ≤ j.
    /// - `portfolio_value` USDC 6-decimal value.
    /// - `z_score`         critical z, WAD-scaled (e.g. 1_645e15 ≈ 95% one-sided).
    /// - `horizon_sqrt`    √(time horizon in years), WAD-scaled.
    ///
    /// Returns VaR in USDC 6-decimal units.
    pub fn compute_portfolio_var(
        &self,
        weights: Vec<U256>,
        vols: Vec<U256>,
        corr_packed: Vec<I256>,
        portfolio_value: U256,
        z_score: U256,
        horizon_sqrt: U256,
    ) -> U256 {
        let n = weights.len();
        if n == 0 || vols.len() != n {
            return U256::ZERO;
        }
        let expected_corr_len = n * (n + 1) / 2;
        if corr_packed.len() != expected_corr_len {
            return U256::ZERO;
        }

        // Σ_i Σ_j wᵢ wⱼ σᵢ σⱼ ρᵢⱼ
        let mut variance = I256::ZERO;
        for i in 0..n {
            for j in 0..n {
                let mut term = mul_wad_u(weights[i], weights[j]);
                term = mul_wad_u(term, vols[i]);
                term = mul_wad_u(term, vols[j]);
                let rho = read_corr(&corr_packed, n, i, j);
                let signed_term = I256::try_from(term).unwrap_or(I256::ZERO);
                let prod = mul_wad_i(signed_term, rho);
                variance = variance.saturating_add(prod);
            }
        }

        // Variance must be non-negative; clamp.
        let variance_u: U256 = if variance.is_negative() {
            U256::ZERO
        } else {
            U256::try_from(variance).unwrap_or(U256::ZERO)
        };

        let portfolio_vol = sqrt_wad(variance_u);
        let var_pct = mul_wad_u(mul_wad_u(z_score, portfolio_vol), horizon_sqrt);

        let wad = U256::from(WAD);
        portfolio_value.saturating_mul(var_pct) / wad
    }

    /// Convenience view of the last computed VaR (only set by `record_var`).
    pub fn last_var(&self) -> U256 {
        self.last_var.get()
    }

    /// Same as `compute_portfolio_var` but persists the result. Used by the
    /// Solidity Vault when it wants a checkpointed risk metric on-chain.
    pub fn record_var(
        &mut self,
        weights: Vec<U256>,
        vols: Vec<U256>,
        corr_packed: Vec<I256>,
        portfolio_value: U256,
        z_score: U256,
        horizon_sqrt: U256,
    ) -> U256 {
        let v = self.compute_portfolio_var(
            weights,
            vols,
            corr_packed,
            portfolio_value,
            z_score,
            horizon_sqrt,
        );
        self.last_var.set(v);
        v
    }
}

/// Read correlation ρᵢⱼ from the packed upper-triangular array.
fn read_corr(packed: &[I256], n: usize, i: usize, j: usize) -> I256 {
    let (a, b) = if i <= j { (i, j) } else { (j, i) };
    let idx = a * (2 * n - a + 1) / 2 + (b - a);
    packed[idx]
}

/// WAD-aware unsigned multiplication: (a · b) / WAD.
fn mul_wad_u(a: U256, b: U256) -> U256 {
    let wad = U256::from(WAD);
    a.saturating_mul(b) / wad
}

/// WAD-aware signed multiplication: (a · b) / WAD.
fn mul_wad_i(a: I256, b: I256) -> I256 {
    let wad = I256::try_from(U256::from(WAD)).unwrap();
    let prod = a.checked_mul(b).unwrap_or(I256::ZERO);
    prod.checked_div(wad).unwrap_or(I256::ZERO)
}

/// Integer sqrt (Babylonian/Newton). Returns ⌊√x⌋.
fn isqrt(x: U256) -> U256 {
    if x.is_zero() {
        return U256::ZERO;
    }
    let two = U256::from(2);
    let mut z = (x + U256::from(1)) / two;
    let mut y = x;
    while z < y {
        y = z;
        z = (x / z + z) / two;
    }
    y
}

/// WAD-preserving sqrt: result satisfies (result/WAD)² ≈ x/WAD.
fn sqrt_wad(x: U256) -> U256 {
    let wad = U256::from(WAD);
    isqrt(x.saturating_mul(wad))
}

#[cfg(test)]
mod test {
    use super::*;
    use stylus_sdk::testing::*;

    fn wad_from(x: u128, denom: u128) -> U256 {
        U256::from(x).saturating_mul(U256::from(WAD)) / U256::from(denom)
    }

    fn wad_i_from(x: i128, denom: i128) -> I256 {
        let scaled = (x.unsigned_abs() as u128).saturating_mul(WAD as u128) / denom.unsigned_abs() as u128;
        let s = I256::try_from(U256::from(scaled)).unwrap();
        if x.signum() < 0 { -s } else { s }
    }

    /// Reference: 2 assets, w=(0.5,0.5), σ=(0.20,0.30), ρ=0.5, V=$1M, z=1.645, t=1d.
    /// Analytical VaR ≈ $22,580.
    #[test]
    fn var_two_assets_known() {
        let vm = TestVM::default();
        let contract = SigmaCore::from(&vm);

        let weights = alloc::vec![wad_from(1, 2), wad_from(1, 2)]; // 0.5, 0.5
        let vols = alloc::vec![wad_from(20, 100), wad_from(30, 100)]; // 0.20, 0.30
        // packed upper-tri for n=2: [ρ00, ρ01, ρ11] = [1, 0.5, 1]
        let corr = alloc::vec![
            wad_i_from(1, 1),
            wad_i_from(1, 2),
            wad_i_from(1, 1),
        ];
        let portfolio_value = U256::from(1_000_000u64).saturating_mul(U256::from(1_000_000u64)); // $1M in USDC 6-dec
        let z = wad_from(1645, 1000); // 1.645
        // √(1/252) ≈ 0.0629941 → in WAD: 62_994_079_237_678_000
        let horizon_sqrt = U256::from(62_994_079_237_678_000u128);

        let var = contract.compute_portfolio_var(
            weights,
            vols,
            corr,
            portfolio_value,
            z,
            horizon_sqrt,
        );

        // Expected ≈ $22,580 = 22_580_000_000 (6-decimal USDC). Allow ±2% for sqrt rounding.
        let lo = U256::from(22_000_000_000u64);
        let hi = U256::from(23_500_000_000u64);
        assert!(
            var >= lo && var <= hi,
            "VaR out of expected range: got {}, expected ~22.58e9",
            var
        );
    }

    #[test]
    fn zero_portfolio_returns_zero() {
        let vm = TestVM::default();
        let contract = SigmaCore::from(&vm);
        let weights = alloc::vec![wad_from(1, 1)];
        let vols = alloc::vec![wad_from(20, 100)];
        let corr = alloc::vec![wad_i_from(1, 1)];
        let var = contract.compute_portfolio_var(
            weights,
            vols,
            corr,
            U256::ZERO,
            wad_from(1645, 1000),
            U256::from(62_994_079_237_678_000u128),
        );
        assert_eq!(var, U256::ZERO);
    }

    #[test]
    fn mismatched_lengths_return_zero() {
        let vm = TestVM::default();
        let contract = SigmaCore::from(&vm);
        let weights = alloc::vec![wad_from(1, 2), wad_from(1, 2)];
        let vols = alloc::vec![wad_from(20, 100)]; // wrong length
        let corr = alloc::vec![wad_i_from(1, 1)];
        let var = contract.compute_portfolio_var(
            weights,
            vols,
            corr,
            U256::from(1_000_000u64),
            wad_from(1645, 1000),
            U256::from(62_994_079_237_678_000u128),
        );
        assert_eq!(var, U256::ZERO);
    }
}
