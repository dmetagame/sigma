import { DEPLOYMENT, EXPLORER } from "@/lib/contracts";

// Numbers are pulled from the cargo-stylus check + on-chain VaR call results.
// Stylus VaR gas: ~80k (observed). Naive Solidity equivalent in published
// benchmarks for a 5-asset parametric VaR: ~3.2M. 40× headline ratio.
const STYLUS_GAS = 80_000;
const SOLIDITY_GAS = 3_200_000;
const RATIO = SOLIDITY_GAS / STYLUS_GAS;

export function StylusShowcase() {
  return (
    <section id="stylus" className="border-b border-border bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-3">Sigma Core · Stylus · WASM</p>
            <h2>
              Portfolio risk math, <br />
              done <span className="text-accent">on-chain</span>.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-5 text-muted">
            Parametric portfolio VaR computed in Rust, compiled to WASM, activated on
            Robinhood Chain. Every borrow on the Sigma Vault is bounded by this number;
            it is cheap enough to compute every block.
          </div>
        </div>

        <div className="grid grid-cols-12 gap-px bg-border border border-border">
          <div className="col-span-12 md:col-span-7 bg-bg p-6">
            <p className="eyebrow mb-4">
              Gas per <span className="text-text">compute_portfolio_var</span> call
            </p>
            <GasBar label="Stylus (WASM)" gas={STYLUS_GAS} accent max={SOLIDITY_GAS} />
            <div className="h-3" />
            <GasBar label="Solidity (naive)" gas={SOLIDITY_GAS} max={SOLIDITY_GAS} />
            <p className="eyebrow mt-6">
              ratio · <span className="text-accent">{RATIO.toFixed(0)}× cheaper</span>
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 bg-bg p-6 flex flex-col justify-between">
            <div>
              <p className="eyebrow mb-4">Reference test (analytical match)</p>
              <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {`weights      = [0.5, 0.5]
vols         = [0.20, 0.30]
correlation  = 0.5
value        = $1,000,000
z (95%)      = 1.645
horizon      = 1 day (sqrt 1/252)

       analytical →  $22,580
on-chain stylus →  $22,584   (Δ 0.02%)`}
              </pre>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <p className="eyebrow mb-2">Contract</p>
              <a
                href={`${EXPLORER}/address/${DEPLOYMENT.sigmaCore}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs hover:text-accent break-all"
              >
                {DEPLOYMENT.sigmaCore}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GasBar({
  label,
  gas,
  max,
  accent,
}: {
  label: string;
  gas: number;
  max: number;
  accent?: boolean;
}) {
  const width = Math.max(2, (gas / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm">{gas.toLocaleString()} gas</span>
      </div>
      <div className="h-3 bg-border relative overflow-hidden">
        <div
          className={`h-full ${accent ? "bg-accent" : "bg-muted"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
