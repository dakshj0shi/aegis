// ─── Uniswap Protocol Adapter ───────────────────────────────────────────────
// Fetches Uniswap V3 pool data and TVL across chains.

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const UNISWAP_FACTORY_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    arbitrum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
};

const WETH_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    base: "0x4200000000000000000000000000000000000006",
};

const USDC_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const UNISWAP_ABI = [
    {
        name: "getPool",
        inputs: [
            { name: "tokenA", type: "address" },
            { name: "tokenB", type: "address" },
            { name: "fee", type: "uint24" },
        ],
        outputs: [{ name: "pool", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
];

const UNISWAP_POOL_ABI = [
    {
        name: "slot0",
        inputs: [],
        outputs: [
            { name: "sqrtPriceX96", type: "uint160" },
            { name: "tick", type: "int24" },
            { name: "observationIndex", type: "uint16" },
            { name: "observationCardinality", type: "uint16" },
            { name: "observationCardinalityNext", type: "uint16" },
            { name: "feeProtocol", type: "uint8" },
            { name: "unlocked", type: "bool" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "liquidity",
        inputs: [],
        outputs: [{ name: "", type: "uint128" }],
        stateMutability: "view",
        type: "function",
    },
];

/**
 * Fetch Uniswap protocol metrics for a given chain.
 */
export async function fetchUniswapMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolAdapterResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const factory = UNISWAP_FACTORY_BY_CHAIN[chain];
    const weth = WETH_BY_CHAIN[chain];
    const usdc = USDC_BY_CHAIN[chain];
    console.log(`[Uniswap:${chain}] Fetching pool data from factory ${factory}`);

    try {
        const poolAddress = await client.callContract<string>({
            contractAddress: factory,
            functionSignature: "getPool(address,address,uint24)",
            args: [weth, usdc, 3000],
            abi: UNISWAP_ABI,
        });
        if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
            throw new Error("Uniswap pool not found");
        }

        const [liquidity, slot0] = await Promise.all([
            client.callContract<bigint>({
                contractAddress: poolAddress,
                functionSignature: "liquidity()",
                args: [],
                abi: UNISWAP_POOL_ABI,
            }),
            client.callContract<any>({
                contractAddress: poolAddress,
                functionSignature: "slot0()",
                args: [],
                abi: UNISWAP_POOL_ABI,
            }),
        ]);

        const tick = Number(slot0?.tick ?? slot0?.[1] ?? 0);
        const claimed = Number(liquidity / 10n ** 6n);
        const utilizationBps = Math.min(10_000, Math.abs(tick));
        const actual = Math.max(0, Math.floor((claimed * (10_000 - utilizationBps)) / 10_000));
        const solvencyRatioBps = claimed > 0 ? Math.round((actual / claimed) * 10_000) : 10_000;

        return {
            name: "Uniswap V3",
            chain,
            claimed,
            actual,
            solvencyRatioBps,
            utilizationBps,
            timestamp,
            details: { adapter: "uniswap-v3", pool: poolAddress, tick, source: chain },
        };
    } catch (error) {
        console.error(`[Uniswap:${chain}] Error:`, error);
        return {
            name: "Uniswap V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatioBps: 10_000,
            utilizationBps: 0,
            timestamp,
            details: { adapter: "uniswap-v3", error: (error as Error).message, degraded: true },
        };
    }
}

/**
 * Fetch Uniswap metrics across all supported chains.
 */
export async function fetchUniswapMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolAdapterResult[]> {
    const tasks = Array.from(clients.entries()).map(([chain, client]) => fetchUniswapMetrics(client, chain));
    return Promise.all(tasks);
}
