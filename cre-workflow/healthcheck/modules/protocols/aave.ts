// ─── Aave Protocol Adapter ──────────────────────────────────────────────────
// Fetches Aave V3 pool data across supported chains.

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const AAVE_POOL_ETHEREUM = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

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

    if (chain !== "ethereum") {
        return {
            name: "Aave V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 1.0,
            utilizationBps: 0,
            details: { reason: "unsupported-chain" },
        };
    }

    try {
        const incomeRay = await client.callContract<bigint>({
            contractAddress: AAVE_POOL_ETHEREUM,
            functionSignature: "getReserveNormalizedIncome(address)",
            args: [WETH_ETHEREUM],
            abi: AAVE_ABI,
        });
        const debtRay = await client.callContract<bigint>({
            contractAddress: AAVE_POOL_ETHEREUM,
            functionSignature: "getReserveNormalizedVariableDebt(address)",
            args: [WETH_ETHEREUM],
            abi: AAVE_ABI,
        });

        const claimedRaw = incomeRay > 0n ? incomeRay : 1n;
        const debtRaw = debtRay > claimedRaw ? claimedRaw : debtRay;
        const claimed = Number(claimedRaw / 10n ** 18n);
        const actual = Number((claimedRaw - debtRaw) / 10n ** 18n);
        const utilizationBps = Number((debtRaw * 10_000n) / claimedRaw);
        const solvencyRatio = claimed > 0 ? actual / claimed : 1;

        console.log(`[ADAPTER:Aave] ${chain.toUpperCase()} fetched. Latency: ${Date.now() - startTime}ms`);

        return {
            name: "Aave V3",
            chain,
            claimed,
            actual,
            solvencyRatio,
            utilizationBps,
            details: {
                adapter: "aave-v3",
                pool: AAVE_POOL_ETHEREUM,
                source: "mainnet",
            },
        };
    } catch (error) {
        console.error(`[ADAPTER:Aave] CRITICAL FAILURE on ${chain}:`, (error as Error).message);
        return {
            name: "Aave V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 0.5, // Return stressed state on adapter failure for safety
            utilizationBps: 10_000,
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
    const ethClient = clients.get("ethereum");
    if (!ethClient) return [];
    return [await fetchAaveMetrics(ethClient, "ethereum")];
}
