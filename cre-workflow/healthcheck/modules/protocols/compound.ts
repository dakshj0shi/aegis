// ─── Compound Protocol Adapter ──────────────────────────────────────────────
// Fetches Compound V3 (Comet) data across supported chains.

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const COMPOUND_COMET_ETHEREUM = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";

const COMPOUND_ABI = [
    {
        name: "totalSupply",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "totalBorrow",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "getUtilization",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

export async function fetchCompoundMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolAdapterResult> {
    const startTime = Date.now();

    if (chain !== "ethereum") {
        return {
            name: "Compound V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 1.0,
            utilizationBps: 0,
            details: { reason: "unsupported-chain" },
        };
    }

    try {
        const totalSupply = await client.callContract<bigint>({
            contractAddress: COMPOUND_COMET_ETHEREUM,
            functionSignature: "totalSupply()",
            args: [],
            abi: COMPOUND_ABI,
        });
        const totalBorrow = await client.callContract<bigint>({
            contractAddress: COMPOUND_COMET_ETHEREUM,
            functionSignature: "totalBorrow()",
            args: [],
            abi: COMPOUND_ABI,
        });

        const claimedRaw = totalSupply > 0n ? totalSupply : 1n;
        const borrowedRaw = totalBorrow > claimedRaw ? claimedRaw : totalBorrow;
        const claimed = Number(claimedRaw / 10n ** 6n);
        const actual = Number((claimedRaw - borrowedRaw) / 10n ** 6n);
        const utilizationBps = Number((borrowedRaw * 10_000n) / claimedRaw);
        const solvencyRatio = claimed > 0 ? actual / claimed : 1;

        console.log(`[ADAPTER:Compound] ${chain.toUpperCase()} fetched. Latency: ${Date.now() - startTime}ms`);

        return {
            name: "Compound V3",
            chain,
            claimed,
            actual,
            solvencyRatio,
            utilizationBps,
            details: { adapter: "compound-v3", comet: COMPOUND_COMET_ETHEREUM, source: "mainnet" },
        };
    } catch (error) {
        console.error(`[ADAPTER:Compound] FAILURE on ${chain}:`, error);
        return {
            name: "Compound V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 0.5,
            utilizationBps: 10_000,
            details: { adapter: "compound-v3", error: (error as Error).message, degraded: true },
        };
    }
}

/**
 * Fetch Compound metrics across all supported chains.
 */
export async function fetchCompoundMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolAdapterResult[]> {
    const ethClient = clients.get("ethereum");
    if (!ethClient) return [];
    return [await fetchCompoundMetrics(ethClient, "ethereum")];
}
