// ─── Lido Protocol Adapter ──────────────────────────────────────────────────
// Fetches Lido stETH metrics (Ethereum only).

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

const LIDO_STETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";

const STETH_ABI = [
    {
        name: "totalSupply",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "getTotalPooledEther",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

export async function fetchLidoMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolAdapterResult> {
    if (chain !== "ethereum") {
        return {
            name: "Lido",
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
            contractAddress: LIDO_STETH_ADDRESS,
            functionSignature: "totalSupply()",
            args: [],
            abi: STETH_ABI,
        });
        const totalPooledEther = await client.callContract<bigint>({
            contractAddress: LIDO_STETH_ADDRESS,
            functionSignature: "getTotalPooledEther()",
            args: [],
            abi: STETH_ABI,
        });

        const claimed = Number(totalSupply / 10n ** 18n);
        const actual = Number(totalPooledEther / 10n ** 18n);
        const rawUtilization = claimed > 0 ? Math.round(((claimed - actual) / claimed) * 10_000) : 0;
        const utilizationBps = Math.max(0, Math.min(10_000, rawUtilization));
        const solvencyRatio = claimed > 0 ? actual / claimed : 1;

        return {
            name: "Lido",
            chain,
            claimed,
            actual,
            solvencyRatio,
            utilizationBps,
            details: { adapter: "lido-steth", source: "mainnet" },
        };
    } catch (error) {
        return {
            name: "Lido",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 0.9,
            utilizationBps: 9_500,
            details: { adapter: "lido-steth", error: (error as Error).message, degraded: true },
        };
    }
}

export async function fetchLidoMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolAdapterResult[]> {
    const ethClient = clients.get("ethereum");
    if (!ethClient) return [];
    return [await fetchLidoMetrics(ethClient, "ethereum")];
}
