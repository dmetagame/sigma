import { DEPLOYMENT, EXPLORER } from "@/lib/contracts";

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow mb-6">
            Stylus · WASM · Robinhood Chain · chain id <span className="text-text">46630</span>
          </p>
          <h1 className="mb-8">
            On-chain <span className="accent-serif italic">risk pricing</span>
            <br />
            for tokenized equity collateral.
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            Tokenized stocks cannot become useful DeFi collateral until somebody builds
            real risk pricing on-chain. Sigma does it in Stylus — gas-cheap enough that
            every borrow can be sized against a live portfolio VaR.
          </p>
        </div>
        <aside className="col-span-12 md:col-span-4">
          <div className="panel p-5 space-y-3">
            <div>
              <p className="eyebrow mb-1">Sigma Core · Stylus</p>
              <a
                href={`${EXPLORER}/address/${DEPLOYMENT.sigmaCore}`}
                className="font-mono text-xs text-text hover:text-accent break-all"
                target="_blank"
                rel="noreferrer"
              >
                {DEPLOYMENT.sigmaCore}
              </a>
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="eyebrow mb-1">Sigma Vault</p>
              <a
                href={`${EXPLORER}/address/${DEPLOYMENT.sigmaVault}`}
                className="font-mono text-xs text-text hover:text-accent break-all"
                target="_blank"
                rel="noreferrer"
              >
                {DEPLOYMENT.sigmaVault}
              </a>
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="eyebrow mb-1">Sigma Strategist</p>
              <a
                href={`${EXPLORER}/address/${DEPLOYMENT.sigmaStrategist}`}
                className="font-mono text-xs text-text hover:text-accent break-all"
                target="_blank"
                rel="noreferrer"
              >
                {DEPLOYMENT.sigmaStrategist}
              </a>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center gap-2 pt-1">
              <span className="pulse-dot" />
              <span className="font-mono text-xs text-muted">
                live · activated on RH testnet
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
