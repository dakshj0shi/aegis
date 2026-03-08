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
        const debtCeilingRaw = await client.callContract<bigint>({
            contractAddress: MAKER_ADDRESSES.vat,
            functionSignature: "Line()",
            args: [],
            abi: MAKER_ABI,
        });
        const currentDebtRaw = await client.callContract<bigint>({
            contractAddress: MAKER_ADDRESSES.vat,
            functionSignature: "debt()",
            args: [],
            abi: MAKER_ABI,
        });

        // Vat values are in RAD (10^45). Convert to DAI scale.
        const debtCeiling = Number(debtCeilingRaw / 10n ** 45n);
        const currentDebt = Number(currentDebtRaw / 10n ** 45n);
        const collateral = debtCeiling;
        const safeDebt = Math.min(currentDebt, collateral);

        return {
            name: "MakerDAO",
            chain,
            claimed: collateral,
            actual: collateral - safeDebt,
            solvencyRatio: collateral > 0 ? (collateral - safeDebt) / collateral : 1,
            utilizationBps: debtCeiling > 0 ? Math.round((safeDebt / debtCeiling) * 10_000) : 0,
            details: { adapter: "maker", vat: MAKER_ADDRESSES.vat, source: "mainnet" },
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
