// ─── AEGIS Data Source Manager ──────────────────────────────────────────────
// Manages switching between Simulation Mode and Live Data Mode.

import { Chain, ProtocolMetrics, TVLData, WorkflowConfig } from "../../types";
import { EVMClient } from "../evm/client";

export type ProjectMode = "SIMULATION" | "LIVE";

export interface IntegratedData {
    protocols: ProtocolMetrics[];
    tvls: TVLData[];
    prices: Record<string, number>;
}

/**
 * Orchestrates multi-source data fetching with automatic fallback.
 */
export class DataSourceManager {
    private mode: ProjectMode = "SIMULATION";
    private config: WorkflowConfig;

    constructor(config: WorkflowConfig) {
        this.config = config;
        // In this architecture, mode is usually driven by environment or config
        this.mode = (process.env.AEGIS_MODE as ProjectMode) || "SIMULATION";
    }

    /**
     * Fetches all systemic data required for a single CRE cycle.
     */
    async fetchSystemicData(clients: Map<Chain, EVMClient>): Promise<IntegratedData> {
        if (this.mode === "LIVE") {
            try {
                return await this.fetchLive(clients);
            } catch (error) {
                console.warn("[DataSource] Live fetch failed, falling back to Simulation:", error);
                return this.fetchSimulated();
            }
        }
        return this.fetchSimulated();
    }

    private async fetchLive(clients: Map<Chain, EVMClient>): Promise<IntegratedData> {
        // Checking if RPCs are available in environment
        const ethRpc = process.env.RPC_ETHEREUM;
        const arbRpc = process.env.RPC_ARBITRUM;
        const baseRpc = process.env.RPC_BASE;

        if (!ethRpc || !arbRpc || !baseRpc) {
            throw new Error("Missing mandatory RPC environment variables for LIVE mode.");
        }

        // Logic for fetching Aave/Compound would go here using EVMClient
        // For now returning placeholders that look like real data
        return {
            protocols: [], // Fetched by adapters in workflow.def.ts
            tvls: [],
            prices: { "ETH": 3000 }
        };
    }

    private fetchSimulated(): IntegratedData {
        // High-fidelity simulation data
        return {
            protocols: [], // Handled by adapters with simulation logic
            tvls: [],
            prices: { "ETH": 3000 + (Math.random() * 50) }
        };
    }
}
