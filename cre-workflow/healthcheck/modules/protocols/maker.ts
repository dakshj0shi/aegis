// ─── Maker Protocol Adapter ─────────────────────────────────────────────────
// Fetches MakerDAO / SKY protocol data (DAI stability, DSR, vaults).

import { ProtocolAdapterResult, Chain } from "../../types";
import { EVMClient } from "../evm/client";

// Maker core contract addresses (Ethereum mainnet only)
const MAKER_ADDRESSES = {
    vat: "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B",
    spot: "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3",
    jug: "0x19c0976f590D67707E62397C87829d896Dc0f1F1",
    pot: "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7",
};

const MAKER_ABI = [
    {
        name: "Line",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        name: "debt",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

/**
 * Fetch MakerDAO protocol metrics.
 * Maker is Ethereum-only.
 */
export async function fetchMakerMetrics(
    client: EVMClient,
    chain: Chain
): Promise<ProtocolAdapterResult> {
    if (chain !== "ethereum") {
        return {
            name: "MakerDAO",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 1.0,
            utilizationBps: 0,
            details: { reason: "unsupported-chain" },
        };
    }

    console.log(`[Maker:${chain}] Fetching Vat data from ${MAKER_ADDRESSES.vat}`);

    try {
        // Read total debt ceiling (Line) and current debt
        await client.callContract({
            contractAddress: MAKER_ADDRESSES.vat,
            functionSignature: "Line()",
            args: [],
            abi: MAKER_ABI,
        });

        await client.callContract({
            contractAddress: MAKER_ADDRESSES.vat,
            functionSignature: "debt()",
            args: [],
            abi: MAKER_ABI,
        });

        // Demo: simulate realistic Maker metrics
        const debtCeiling = 8_000_000_000; // $8B ceiling
        const currentDebt = 5_200_000_000; // $5.2B DAI outstanding
        const collateral = 10_400_000_000; // $10.4B collateral (200% ratio)

        return {
            name: "MakerDAO",
            chain,
            claimed: collateral,
            actual: collateral - currentDebt,
            solvencyRatio: (collateral - currentDebt) / collateral,
            utilizationBps: Math.round((currentDebt / debtCeiling) * 10_000),
            details: { adapter: "maker" },
        };
    } catch (error) {
        console.error(`[Maker:${chain}] Error:`, error);
        return {
            name: "MakerDAO",
            chain,
            claimed: 0,
            actual: 0,
            solvencyRatio: 1.0,
            utilizationBps: 0,
            details: { adapter: "maker", error: (error as Error).message, degraded: true },
        };
    }
}

/**
 * Fetch Maker metrics (Ethereum only).
 */
export async function fetchMakerMultichain(
    clients: Map<Chain, EVMClient>
): Promise<ProtocolAdapterResult[]> {
    const ethClient = clients.get("ethereum");
    if (!ethClient) return [];

    const metrics = await fetchMakerMetrics(ethClient, "ethereum");
    return [metrics];
}
