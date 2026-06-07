"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { getAddress, type Address } from "viem";
import { robinhoodTestnet } from "./chain";

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletState {
  address?: Address;
  chainId?: number;
  isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  switchToRobinhood(): Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

function parseAddress(value: unknown): Address | undefined {
  if (!Array.isArray(value) || typeof value[0] !== "string") return undefined;
  return getAddress(value[0]);
}

function parseChainId(value: unknown): number | undefined {
  return typeof value === "string" ? Number.parseInt(value, 16) : undefined;
}

export function WalletProvider({ children }: PropsWithChildren) {
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    const handleAccounts = (accounts: unknown) => setAddress(parseAddress(accounts));
    const handleChain = (chain: unknown) => setChainId(parseChainId(chain));

    Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]).then(([accounts, chain]) => {
      handleAccounts(accounts);
      handleChain(chain);
    }).catch(() => undefined);

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) throw new Error("No injected wallet found");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    setAddress(parseAddress(accounts));
    setChainId(parseChainId(await provider.request({ method: "eth_chainId" })));
  }, []);

  const disconnect = useCallback(() => setAddress(undefined), []);

  const switchToRobinhood = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) throw new Error("No injected wallet found");
    const chainIdHex = `0x${robinhoodTestnet.id.toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (cause) {
      const code = (cause as { code?: number }).code;
      if (code !== 4902) throw cause;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: robinhoodTestnet.name,
            nativeCurrency: robinhoodTestnet.nativeCurrency,
            rpcUrls: robinhoodTestnet.rpcUrls.default.http,
            blockExplorerUrls: [robinhoodTestnet.blockExplorers.default.url],
          },
        ],
      });
    }
    setChainId(robinhoodTestnet.id);
  }, []);

  const value = useMemo(
    () => ({
      address,
      chainId,
      isConnected: address !== undefined,
      connect,
      disconnect,
      switchToRobinhood,
    }),
    [address, chainId, connect, disconnect, switchToRobinhood],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside WalletProvider");
  return wallet;
}
