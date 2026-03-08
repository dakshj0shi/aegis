// ─── Compound Protocol Adapter ──────────────────────────────────────────────
// Fetches Compound V3 (Comet) data across supported chains.

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const COMPOUND_COMET_BY_CHAIN: Record<Chain, string> = {
    ethereum: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    arbitrum: "0x9c4ec768c28520B50860ea7a15BD7213a9fF58bf",
    base: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
};

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
    const timestamp = Math.floor(Date.now() / 1000);

    try {
        const comet = COMPOUND_COMET_BY_CHAIN[chain];
        const totalSupply = await client.callContract<bigint>({
            contractAddress: comet,
            functionSignature: "totalSupply()",
            args: [],
            abi: COMPOUND_ABI,
        });
        const totalBorrow = await client.callContract<bigint>({
            contractAddress: comet,
            functionSignature: "totalBorrow()",
            args: [],
            abi: COMPOUND_ABI,
        });

        const claimedRaw = totalSupply > 0n ? totalSupply : 1n;
        const borrowedRaw = totalBorrow > claimedRaw ? claimedRaw : totalBorrow;
        const claimed = Number(claimedRaw / 10n ** 6n);
        const actual = Number((claimedRaw - borrowedRaw) / 10n ** 6n);
        const utilizationBps = Number((borrowedRaw * 10_000n) / claimedRaw);
        const solvencyRatioBps = claimed > 0 ? Math.round((actual / claimed) * 10_000) : 10_000;

        console.log(`[ADAPTER:Compound] ${chain.toUpperCase()} fetched. Latency: ${Date.now() - startTime}ms`);

        return {
            name: "Compound V3",
            chain,
            claimed,
            actual,
            solvencyRatioBps,
            utilizationBps,
            timestamp,
            details: { adapter: "compound-v3", comet, source: chain },
        };
    } catch (error) {
        console.error(`[ADAPTER:Compound] FAILURE on ${chain}:`, error);
        return {
            name: "Compound V3",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatioBps: 5_000,
            utilizationBps: 10_000,
            timestamp,
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
    const tasks = Array.from(clients.entries()).map(([chain, client]) => fetchCompoundMetrics(client, chain));
    return Promise.all(tasks);
}
