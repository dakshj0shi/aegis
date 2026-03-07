// ─── AEGIS CRE Workflow Entry Point ─────────────────────────────────────────
// Registers the AEGIS health check workflow with Chainlink CRE runtime.

import { execute, WorkflowRuntime } from "./workflow.def";
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
        type: "schedule",
        interval: "60s",
    },
    capabilities: [
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
        reportId: report.reportId,
        riskScore: report.finalRiskScore,
        severity: report.severity,
        timestamp: report.timestamp,
        policyHash: report.policyHash,
        checkNumber: report.checkNumber,
    };
}

// ─── Local Development Runner ───────────────────────────────────────────────
// Allows running the workflow locally for development and testing.

if (typeof process !== "undefined" && process.argv?.includes("--local")) {
    console.log("🔧 Running AEGIS workflow in local development mode...\n");

    const mockRuntime = {
        getSecret: async (key: string) => {
            console.log(`[Mock] Secret requested: ${key}`);
            return "mock-secret-value";
        },
        getEnvironment: () => "local",
    };

    main(mockRuntime)
        .then((result) => {
            console.log("\n📊 Workflow Result:", JSON.stringify(result, null, 2));
        })
        .catch((error) => {
            console.error("❌ Workflow failed:", error);
            process.exit(1);
        });
}
