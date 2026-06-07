import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { StylusShowcase } from "@/components/StylusShowcase";
import { PilotLog } from "@/components/PilotLog";

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <PortfolioPanel />
        <StylusShowcase />
        <PilotLog />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <p className="font-display text-xl tracking-tight">Σ Sigma</p>
            <p className="eyebrow mt-2">Arbitrum Open House London · Online Buildathon · 2026</p>
          </div>
          <div className="col-span-12 md:col-span-6 md:text-right text-muted text-sm">
            Stylus · WASM · Robinhood Chain testnet · chain id 46630
          </div>
        </div>
      </footer>
    </>
  );
}
