import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem/utils";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env.local") });

const chain = defineChain({
  id: Number(process.env.RH_TESTNET_CHAIN_ID ?? "46630"),
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RH_TESTNET_RPC ?? "https://rpc.testnet.chain.robinhood.com"] },
  },
});

const oracleAbi = [
  {
    type: "function",
    name: "priceOf",
    stateMutability: "view",
    inputs: [{ name: "stock", type: "address" }],
    outputs: [
      { name: "priceWad", type: "uint192" },
      { name: "observedAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "updatePrices",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stocks", type: "address[]" },
      { name: "pricesWad", type: "uint256[]" },
      { name: "observedAts", type: "uint64[]" },
      { name: "evidenceHashes", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

interface StockConfig {
  symbol: string;
  address: Address;
  pythId: Hex;
}

const stocks: StockConfig[] = [
  {
    symbol: "TSLA",
    address: (process.env.STOCK_TSLA_ADDR ?? "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E") as Address,
    pythId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  },
  {
    symbol: "AMD",
    address: (process.env.STOCK_AMD_ADDR ?? "0x71178BAc73cBeb415514eB542a8995b82669778d") as Address,
    pythId: "0x3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e",
  },
  {
    symbol: "AMZN",
    address: (process.env.STOCK_AMZN_ADDR ?? "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02") as Address,
    pythId: "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  },
  {
    symbol: "NFLX",
    address: (process.env.STOCK_NFLX_ADDR ?? "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93") as Address,
    pythId: "0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2",
  },
  {
    symbol: "PLTR",
    address: (process.env.STOCK_PLTR_ADDR ?? "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0") as Address,
    pythId: "0x11a70634863ddffb71f2b11f2cff29f73f3db8f6d0b78c49f2b5f4ad36e885f0",
  },
];

interface PythParsedPrice {
  id: string;
  price: { price: string; expo: number; publish_time: number };
}

interface RedStonePrice {
  symbol: string;
  value: number;
  timestamp: number;
  provider: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing env var: ${name}`);
  return value;
}

function pythToWad(price: string, exponent: number): bigint {
  const raw = BigInt(price);
  if (raw <= 0n) throw new Error("Pyth returned a non-positive price");
  const shift = 18 + exponent;
  return shift >= 0 ? raw * 10n ** BigInt(shift) : raw / 10n ** BigInt(-shift);
}

function redStoneToWad(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) throw new Error("RedStone returned an invalid price");
  return parseUnits(value.toFixed(8), 18);
}

function deviationBps(a: bigint, b: bigint): bigint {
  const difference = a > b ? a - b : b - a;
  return (difference * 10_000n + a - 1n) / a;
}

async function fetchPyth(): Promise<Map<string, PythParsedPrice>> {
  const query = stocks.map((stock) => `ids%5B%5D=${stock.pythId.slice(2)}`).join("&");
  const response = await fetch(
    `https://hermes.pyth.network/v2/updates/price/latest?${query}&parsed=true`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Pyth request failed: ${response.status}`);
  const body = (await response.json()) as { parsed?: PythParsedPrice[] };
  return new Map((body.parsed ?? []).map((item) => [item.id.toLowerCase(), item]));
}

async function fetchRedStone(stock: StockConfig): Promise<RedStonePrice> {
  const response = await fetch(
    `https://api.redstone.finance/prices?symbol=${stock.symbol}&provider=redstone-primary-prod`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`RedStone request failed for ${stock.symbol}: ${response.status}`);
  const body = (await response.json()) as RedStonePrice[];
  const price = body[0];
  if (!price || price.symbol !== stock.symbol) throw new Error(`RedStone omitted ${stock.symbol}`);
  return price;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const oracle = required("ORACLE_ADAPTER_ADDR") as Address;
  const maxSourceDeviationBps = BigInt(process.env.ORACLE_MAX_SOURCE_DEVIATION_BPS ?? "200");
  const maxSourceAgeSec = BigInt(process.env.ORACLE_MAX_SOURCE_AGE_SEC ?? String(4 * 24 * 60 * 60));
  const rpcUrl = process.env.RH_TESTNET_RPC ?? "https://rpc.testnet.chain.robinhood.com";
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const [pyth, redStonePrices, block] = await Promise.all([
    fetchPyth(),
    Promise.all(stocks.map(fetchRedStone)),
    publicClient.getBlock(),
  ]);

  const updates = [] as Array<{
    stock: StockConfig;
    priceWad: bigint;
    observedAt: bigint;
    evidenceHash: Hex;
    deviation: bigint;
  }>;

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i]!;
    const pythPrice = pyth.get(stock.pythId.slice(2).toLowerCase());
    if (!pythPrice) throw new Error(`Pyth omitted ${stock.symbol}`);
    const redStonePrice = redStonePrices[i]!;
    const pythWad = pythToWad(pythPrice.price.price, pythPrice.price.expo);
    const redStoneWad = redStoneToWad(redStonePrice.value);
    const deviation = deviationBps(pythWad, redStoneWad);
    if (deviation > maxSourceDeviationBps) {
      throw new Error(
        `${stock.symbol} source deviation ${deviation} bps exceeds ${maxSourceDeviationBps} bps`,
      );
    }

    const pythObservedAt = BigInt(pythPrice.price.publish_time);
    const redStoneObservedAt = BigInt(Math.floor(redStonePrice.timestamp / 1000));
    for (const [source, timestamp] of [
      ["Pyth", pythObservedAt],
      ["RedStone", redStoneObservedAt],
    ] as const) {
      if (timestamp > block.timestamp || block.timestamp - timestamp > maxSourceAgeSec) {
        throw new Error(`${stock.symbol} ${source} timestamp is outside the accepted window`);
      }
    }
    const observedAt = pythObservedAt < redStoneObservedAt ? pythObservedAt : redStoneObservedAt;

    const [, storedAt] = (await publicClient.readContract({
      address: oracle,
      abi: oracleAbi,
      functionName: "priceOf",
      args: [stock.address],
    })) as readonly [bigint, bigint];
    if (observedAt <= storedAt) {
      console.log(`${stock.symbol}: no newer Pyth market observation`);
      continue;
    }

    const priceWad = (pythWad + redStoneWad) / 2n;
    const evidenceHash = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "uint64" },
          { type: "uint64" },
        ],
        [stock.pythId, pythWad, redStoneWad, pythObservedAt, redStoneObservedAt],
      ),
    );
    updates.push({ stock, priceWad, observedAt, evidenceHash, deviation });
    console.log(
      `${stock.symbol}: pyth=${pythWad} redstone=${redStoneWad} deviation=${deviation}bps observedAt=${observedAt}`,
    );
  }

  if (updates.length === 0) {
    console.log("Oracle is current; no transaction required.");
    return;
  }
  if (dryRun) {
    console.log(`Dry run: would publish ${updates.length} prices to ${oracle}`);
    return;
  }

  const privateKey = required("ORACLE_REPORTER_PRIVATE_KEY") as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const args = [
    updates.map((update) => update.stock.address),
    updates.map((update) => update.priceWad),
    updates.map((update) => update.observedAt),
    updates.map((update) => update.evidenceHash),
  ] as const;
  const { request } = await publicClient.simulateContract({
    account,
    address: oracle,
    abi: oracleAbi,
    functionName: "updatePrices",
    args,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Published ${updates.length} prices: tx=${hash} gas=${receipt.gasUsed} status=${receipt.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
