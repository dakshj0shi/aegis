// ─── Aave Protocol Adapter ──────────────────────────────────────────────────
// Fetches Aave V3 pool data across supported chains.

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const AAVE_POOL_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
};

const WETH_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    base: "0x4200000000000000000000000000000000000006",
};

const AAVE_ABI = [
    {
        name: "getReserveNormalizedIncome",
        inputs: [{ name: "asset", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "getReserveNormalizedVariableDebt",
        inputs: [{ name: "asset", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

export async function fetchAaveMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolAdapterResult> {
    const startTime = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);

    try {
        const pool = AAVE_POOL_BY_CHAIN[chain];
        const weth = WETH_BY_CHAIN[chain];
        const incomeRay = await client.callContract<bigint>({
            contractAddress: pool,
            functionSignature: "getReserveNormalizedIncome(address)",
            args: [weth],
            abi: AAVE_ABI,
        });
        const debtRay = await client.callContract<bigint>({
            contractAddress: pool,
            functionSignature: "getReserveNormalizedVariableDebt(address)",
            args: [weth],
            abi: AAVE_ABI,
        });

        const claimedRaw = incomeRay > 0n ? incomeRay : 1n;
        const debtRaw = debtRay > claimedRaw ? claimedRaw : debtRay;
        const claimed = Number(claimedRaw / 10n ** 18n);
        const actual = Number((claimedRaw - debtRaw) / 10n ** 18n);
        const utilizationBps = Number((debtRaw * 10_000n) / claimedRaw);
        const solvencyRatioBps = claimed > 0 ? Math.round((actual / claimed) * 10_000) : 10_000;

        console.log(`[ADAPTER:Aave] ${chain.toUpperCase()} fetched. Latency: ${Date.now() - startTime}ms`);

        return {
            name: "Aave V3",
            chain,
            claimed,
            actual,
            solvencyRatioBps,
            utilizationBps,
            timestamp,
            details: {
                adapter: "aave-v3",
                pool,
                source: chain,
            },
        };
    } catch (error) {
        console.error(`[ADAPTER:Aave] CRITICAL FAILURE on ${chain}:`, (error as Error).message);
        return {
            name: "Aave V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatioBps: 5000, // Return stressed state on adapter failure for safety
            utilizationBps: 10_000,
            timestamp,
            details: { adapter: "aave-v3", error: (error as Error).message, degraded: true },
        };
    }
}

/**
 * Fetch Aave metrics across all supported chains.
 */
export async function fetchAaveMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolAdapterResult[]> {
    const tasks = Array.from(clients.entries()).map(([chain, client]) => fetchAaveMetrics(client, chain));
    return Promise.all(tasks);
}
