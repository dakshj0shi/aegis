// ─── AEGIS Multicall3 Helper ────────────────────────────────────────────────
// Batches multiple contract reads into a single RPC call via Multicall3.

import { EVMClient } from "./client";

interface Call {
    target: string;
    callData: string;
    allowFailure?: boolean;
}

interface CallResult {
    success: boolean;
    returnData: string;
}

const MULTICALL3_ABI = [
    {
        inputs: [
            {
                components: [
                    { name: "target", type: "address" },
                    { name: "allowFailure", type: "bool" },
                    { name: "callData", type: "bytes" },
                ],
                name: "calls",
                type: "tuple[]",
            },
        ],
        name: "aggregate3",
        outputs: [
            {
                components: [
                    { name: "success", type: "bool" },
                    { name: "returnData", type: "bytes" },
                ],
                name: "returnData",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

/**
 * Execute a batch of contract reads via Multicall3.
 * Reduces RPC calls from N to 1 for each chain.
 */
export async function multicall(
    client: EVMClient,
    multicallAddress: string,
    calls: Call[]
): Promise<CallResult[]> {
    console.log(
        `[Multicall:${client.chainName}] Batching ${calls.length} calls via ${multicallAddress}`
    );

    const formattedCalls = calls.map((call) => ({
        target: call.target,
        allowFailure: call.allowFailure ?? true,
        callData: call.callData,
    }));

    const result = await client.readContract({
        contractAddress: multicallAddress,
        functionSignature: "aggregate3((address,bool,bytes)[])",
        args: [formattedCalls],
        abi: MULTICALL3_ABI,
    });

    // Parse results — in CRE runtime, this would decode the return data
    // For demo, return success placeholders
    return calls.map(() => ({
        success: true,
        returnData: "0x",
    }));
}

/**
 * Helper: encode a function call for multicall batching.
 */
export function encodeFunctionCall(
    functionSignature: string,
    args: unknown[]
): string {
    // In production, use ethers.js ABI encoder
    // This is a simplified placeholder for CRE context
    const sighash = functionSignature
        .split("(")[0]
        .padEnd(10, "0")
        .substring(0, 10);
    return "0x" + sighash;
}

/**
 * Helper: decode multicall return data.
 */
export function decodeReturnData(
    returnData: string,
    outputTypes: string[]
): unknown[] {
    // In production, use ethers.js ABI decoder
    console.log(`[Multicall] Decoding ${outputTypes.length} outputs`);
    return outputTypes.map(() => BigInt(0));
}
