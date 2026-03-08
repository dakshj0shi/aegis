// ─── AEGIS CRE Workflow Entry Point ─────────────────────────────────────────
// Registers the AEGIS health check workflow with Chainlink CRE runtime.

import { execute, WorkflowRuntime, cronTrigger } from "./workflow.def";
import { validateConfig } from "./config/schema";
import stagingConfig from "./config/config.staging.json";

/**
 * Workflow metadata for CRE registration.
 */
export const workflowSpec = {
    name: "aegis-healthcheck",
    version: "1.0.0",
    description:
        "AEGIS — Autonomous Economic Guardrail & Intelligence System. " +
        "Multi-chain DeFi risk monitoring and autonomous protection via Chainlink CRE.",
    trigger: {
        type: "cron",
        capability: "CronCapability",
        schedule: cronTrigger.schedule,
    },
    capabilities: [
        "CronCapability",
        "EVMClient",
        "Secrets",
        "HTTP",
        "DONSignedReport",
    ],
};

/**
 * CRE entrypoint — called by the Chainlink DON every 60 seconds.
 */
export async function main(creRuntime: {
    getSecret: (key: string) => Promise<string>;
    getEnvironment: () => string;
}) {
    const env = creRuntime.getEnvironment();
    console.log(`[AEGIS] Starting workflow in ${env} environment`);

    // Load and validate config
    const config = stagingConfig as any;
    if (!validateConfig(config)) {
        throw new Error("Invalid workflow configuration");
    }

    // Create runtime adapter
    const runtime: WorkflowRuntime = {
        getSecret: creRuntime.getSecret,
        getConfig: () => config,
    };

    // Execute the 14-step pipeline
    const report = await execute(runtime);

    // Return report for DON consensus
    return {
        reportId: report.riskReport.reportId,
        riskScore: report.riskReport.finalRiskScore,
        severity: report.riskReport.severity,
        timestamp: report.riskReport.timestamp,
        policyHash: report.riskReport.policyHash,
        checkNumber: report.riskReport.checkNumber,
    };
}

// ───  Development Runner ───────────────────────────────────────────────
// Allows running the workflow for development and testing.

if (typeof process !== "undefined" && process.argv?.includes("--local")) {
    console.log("🔧 Running AEGIS workflow in local development mode...\n");

    const mockRuntime = {
        getSecret: async () => "mock-secret",
        getEnvironment: () => "local",
    };

    const loop = async () => {
        while (true) {
            try {
                const result = await main(mockRuntime);
                console.log("\n📊 Workflow Result:", JSON.stringify(result, null, 2));
            } catch (err) {
                console.error("❌ Workflow failed:", err);
            }

            console.log("\n⏳ Waiting 60 seconds for next cycle...\n");
            await new Promise((r) => setTimeout(r, 3000000));
        }
    };

    loop();
}