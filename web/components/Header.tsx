"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddr } from "@/lib/format";
import { robinhoodTestnet } from "@/lib/chain";

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== robinhoodTestnet.id;

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl tracking-tight leading-none">Σ</span>
          <span className="font-display text-xl tracking-tight leading-none">Sigma</span>
          <span className="eyebrow ml-3">on-chain risk · live</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
          <a href="#portfolio" className="hover:text-text transition-colors">
            Portfolio
          </a>
          <a href="#risk" className="hover:text-text transition-colors">
            Risk
          </a>
          <a href="#stylus" className="hover:text-text transition-colors">
            Stylus
          </a>
          <a href="#pilot" className="hover:text-text transition-colors">
            Pilot
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              {wrongChain && (
                <button
                  onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
                  className="font-mono text-xs border border-amber-400 text-amber-300 px-2 py-1"
                >
                  switch network
                </button>
              )}
              <span className="font-mono text-xs text-muted hidden sm:inline">
                chain {chainId}
              </span>
              <span className="font-mono text-sm">{shortAddr(address)}</span>
              <button
                onClick={() => disconnect()}
                className="font-mono text-xs text-muted hover:text-text transition-colors"
              >
                disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="font-mono text-sm border border-accent text-accent hover:bg-accent-dim transition-colors px-3 py-1.5"
            >
              connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
