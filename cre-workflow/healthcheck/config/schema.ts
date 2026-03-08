// ─── AEGIS Configuration Schema ─────────────────────────────────────────────
// Defines and validates the expected configuration shape for CRE workflow.

import { WorkflowConfig, Chain } from "../types";

const SUPPORTED_CHAINS: Chain[] = [
    "ethereum",
    "arbitrum",
    "base",
];

const SUPPORTED_PROTOCOLS = ["aave", "compound", "uniswap", "maker", "lido"];

export const CONFIG_SCHEMA = {
    chains: {
        type: "array",
        required: true,
        description: "List of chain configurations with RPC endpoints",
        items: {
            name: { type: "string", enum: SUPPORTED_CHAINS },
            rpcUrl: { type: "string", format: "uri" },
            chainId: { type: "number" },
            multicallAddress: { type: "string", format: "address" },
        },
    },
    protocols: {
        type: "array",
        required: true,
        description: "List of protocol names to monitor",
        items: { type: "string", enum: SUPPORTED_PROTOCOLS },
    },
    priceFeeds: {
        type: "object",
        required: true,
        properties: {
            ethUsd: { type: "object", required: true },
            usdcUsd: { type: "object", required: true },
        },
    },
    riskOracleAddress: { type: "string", format: "address", required: true },
    aegisGuardAddress: { type: "string", format: "address", required: true },
    attestationRegistryAddress: { type: "string", format: "address", required: true },
    policyEngineAddress: { type: "string", format: "address", required: true },
    aiServiceUrl: { type: "string", format: "uri", required: true },
    discordWebhookUrl: { type: "string", format: "uri", required: true },
    intervalSeconds: { type: "number", default: 60, required: true },
    policy: {
        type: "object",
        required: true,
        properties: {
            version: { type: "string", required: true },
            velocityThreshold: { type: "number", default: 0.10 },
            solvencyWarning: { type: "number", default: 0.95 },
            solvencyPause: { type: "number", default: 0.90 },
            maxBorrowCap: { type: "number", default: 1000000 },
            collateralFloor: { type: "number", default: 1.5 },
            interestCeiling: { type: "number", default: 0.25 },
        },
    },
} as const;

/**
 * Validates a configuration object against the AEGIS schema.
 */
export function validateConfig(config: unknown): config is WorkflowConfig {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;

    // Required string fields
    const requiredAddresses = [
        "riskOracleAddress",
        "aegisGuardAddress",
        "attestationRegistryAddress",
        "policyEngineAddress",
    ];

    for (const field of requiredAddresses) {
        if (typeof c[field] !== "string" || !(c[field] as string).startsWith("0x")) {
            throw new Error(`Invalid config: ${field} must be a valid address`);
        }
    }

    if (typeof c.aiServiceUrl !== "string") {
        throw new Error("Invalid config: aiServiceUrl must be a valid URL");
    }

    if (!Array.isArray(c.chains) || c.chains.length === 0) {
        throw new Error("Invalid config: chains must be a non-empty array");
    }

    if (!Array.isArray(c.protocols) || c.protocols.length === 0) {
        throw new Error("Invalid config: protocols must be a non-empty array");
    }

    if (!c.priceFeeds || typeof c.priceFeeds !== "object") {
        throw new Error("Invalid config: priceFeeds must be defined");
    }

    return true;
}

export { SUPPORTED_CHAINS, SUPPORTED_PROTOCOLS };
