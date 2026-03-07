// ─── Uniswap Protocol Adapter ───────────────────────────────────────────────
// Fetches Uniswap V3 pool data and TVL across chains.

import { ProtocolMetrics, Chain } from "../../types";
import { EVMClient } from "../evm/client";

// Uniswap V3 Factory addresses per chain
const UNISWAP_FACTORY_ADDRESSES: Partial<Record<Chain, string>> = {
    ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    arbitrum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
};

const UNISWAP_ABI = [
    {
        name: "liquidity",
        inputs: [],
        outputs: [{ name: "", type: "uint128" }],
        stateMutability: "view",
        type: "function",
    },
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
];

/**
 * Fetch Uniswap protocol metrics for a given chain.
 */
export async function fetchUniswapMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolMetrics> {
    const factoryAddress = UNISWAP_FACTORY_ADDRESSES[chain];

    if (!factoryAddress) {
        return {
            protocol: "uniswap",
            chain,
            claimedReserves: 0,
            actualReserves: 0,
            solvencyRatio: 1.0,
            utilization: 0,
            timestamp: Date.now(),
        };
    }

    console.log(`[Uniswap:${chain}] Fetching pool data from factory ${factoryAddress}`);

    try {
        // In production, query top pools' liquidity via multicall
        await client.readContract({
            contractAddress: factoryAddress,
            functionSignature: "getPool(address,address,uint24)",
            args: [],
            abi: UNISWAP_ABI,
        });

        // Demo: simulate realistic Uniswap metrics
        const totalLiquidity = 4_100_000_000; // $4.1B TVL
        const activeLiquidity = 3_800_000_000;

        return {
            protocol: "uniswap",
            chain,
            claimedReserves: totalLiquidity,
            actualReserves: activeLiquidity,
            solvencyRatio: activeLiquidity / totalLiquidity,
            utilization: 0.45, // Trading volume / liquidity ratio
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error(`[Uniswap:${chain}] Error:`, error);
        return {
            protocol: "uniswap",
            chain,
            claimedReserves: 0,
            actualReserves: 0,
            solvencyRatio: 1.0,
            utilization: 0,
            timestamp: Date.now(),
        };
    }
}

/**
 * Fetch Uniswap metrics across all supported chains.
 */
export async function fetchUniswapMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolMetrics[]> {
    const results: ProtocolMetrics[] = [];

    for (const [chain, client] of clients) {
        if (!UNISWAP_FACTORY_ADDRESSES[chain]) continue;
        const metrics = await fetchUniswapMetrics(client, chain);
        results.push(metrics);
    }

    return results;
}
