import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./config.js";

export const robinhoodTestnet = defineChain({
  id: env.RH_TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [env.RH_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: env.RH_TESTNET_EXPLORER },
  },
  testnet: true,
});

export function makePublicClient(): PublicClient {
  return createPublicClient({
    chain: robinhoodTestnet,
    transport: http(env.RH_TESTNET_RPC),
  });
}

export function makeWalletClient(): WalletClient {
  const account = privateKeyToAccount(
    env.PILOT_PRIVATE_KEY as `0x${string}`,
  );
  return createWalletClient({
    account,
    chain: robinhoodTestnet,
    transport: http(env.RH_TESTNET_RPC),
  });
}

export function pilotAddress(): `0x${string}` {
  return privateKeyToAccount(env.PILOT_PRIVATE_KEY as `0x${string}`).address;
}
