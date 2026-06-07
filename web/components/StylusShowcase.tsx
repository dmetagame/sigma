import { DEPLOYMENT, EXPLORER } from "@/lib/contracts";

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
            the Vault computes it during borrow and collateral-withdrawal checks.
          </div>
        </div>

        <div className="grid grid-cols-12 gap-px bg-border border border-border">
          <div className="col-span-12 md:col-span-7 bg-bg p-6">
            <p className="eyebrow mb-5">Implementation profile</p>
            <div className="grid grid-cols-2 gap-px bg-border">
              <Metric label="Runtime" value="Rust · WASM" />
              <Metric label="Risk model" value="Parametric VaR" />
              <Metric label="Math scale" value="WAD · 1e18" />
              <Metric label="Complexity" value="O(n²) covariance" />
            </div>
            <p className="text-sm text-muted mt-5">
              Stylus activation and analytical correctness are reproducible in this repo.
              An apples-to-apples Solidity gas benchmark is still pending, so Sigma does
              not claim a measured multiplier here.
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-4">
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-mono text-sm text-accent">{value}</p>
    </div>
  );
}
