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
import { getAddress, type Address, type Hash, type Hex } from "viem";
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
  sendTransaction(transaction: { to: Address; data: Hex }): Promise<Hash>;
}

const WalletContext = createContext<WalletState | null>(null);

function parseAddress(value: unknown): Address | undefined {
  if (!Array.isArray(value) || typeof value[0] !== "string") return undefined;
  try {
    return getAddress(value[0]);
  } catch {
    return undefined;
  }
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
    // Read the chain back from the provider rather than assuming the switch
    // landed — some wallets resolve the request without actually switching.
    setChainId(parseChainId(await provider.request({ method: "eth_chainId" })));
  }, []);

  const sendTransaction = useCallback(
    async ({ to, data }: { to: Address; data: Hex }) => {
      const provider = window.ethereum;
      if (!provider || !address) throw new Error("Connect a wallet first");
      // Authoritative check against the provider, not React state: a tx
      // submitted on the wrong chain would target unrelated addresses.
      const liveChainId = parseChainId(await provider.request({ method: "eth_chainId" }));
      if (liveChainId !== robinhoodTestnet.id) {
        setChainId(liveChainId);
        throw new Error(`Switch to ${robinhoodTestnet.name} before submitting`);
      }
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to, data }],
      });
      if (typeof hash !== "string") throw new Error("Wallet returned an invalid transaction hash");
      return hash as Hash;
    },
    [address],
  );

  const value = useMemo(
    () => ({
      address,
      chainId,
      isConnected: address !== undefined,
      connect,
      disconnect,
      switchToRobinhood,
      sendTransaction,
    }),
    [address, chainId, connect, disconnect, sendTransaction, switchToRobinhood],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside WalletProvider");
  return wallet;
}
