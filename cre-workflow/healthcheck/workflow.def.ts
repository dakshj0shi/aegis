// ─── AEGIS Workflow Definition ──────────────────────────────────────────────
// Chainlink CRE Workflow: 60-second interval health check pipeline.

import { WorkflowConfig, RiskReport, ProtocolMetrics, TVLData, Severity, AIRiskResponse, ProtocolAdapterResult } from "./types";
import { EVMClient, createClients } from "./modules/evm/client";
import { fetchAaveMultichain } from "./modules/protocols/aave";
import { fetchCompoundMultichain } from "./modules/protocols/compound";

import { fetchUniswapMultichain } from "./modules/protocols/uniswap";
import { fetchMakerMultichain } from "./modules/protocols/maker";
import { fetchLidoMultichain } from "./modules/protocols/lido";
import { fetchPriceFeeds } from "./modules/data/priceFeeds";
import { getCachedProtocols, setCachedProtocols, markDegraded } from "./modules/data/cache";
import { detectVelocity } from "./modules/risk/velocity";
import { detectContagion } from "./modules/risk/contagion";
import { simulateCascade } from "./modules/risk/cascade";
import { calculateFinalScore } from "./modules/risk/scoring";
import { generatePolicyHash } from "./modules/compliance/policy";
import { sendDiscordAlert } from "./modules/alerts/discord";
import { encodeRiskReportPayload } from "./modules/utils/encoding";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowRuntime {
    getSecret: (key: string) => Promise<string>;
    getConfig: () => WorkflowConfig;
}

export const cronTrigger = {
    schedule: "*/60 * * * * *",
};

export interface ExecutionMetric {
    step: string;
    durationMs: number;
    status: "success" | "failed";
    error?: string;
}

export interface HealthCheckReport {
    riskReport: RiskReport;
    metrics: {
        totalDurationMs: number;
        stepMetrics: ExecutionMetric[];
        adapterLatency: Record<string, number>;
        aiLatency: number;
    };
    alerts: any[];
    compliance: any;
}

// ─── Global State ───────────────────────────────────────────────────────────
let checkNumber = 0;
let previousSubmittedSeverity: Severity | null = null;
let previousSubmittedRiskScore: number | null = null;

// ─── Workflow Strategy ──────────────────────────────────────────────────────

export async function execute(runtime: WorkflowRuntime): Promise<HealthCheckReport> {
    checkNumber++;
    const workflowStart = Date.now();
    const stepMetrics: ExecutionMetric[] = [];
    const adapterLatency: Record<string, number> = {};
    let aiLatency = 0;

    console.log(`\n${"═".repeat(70)}`);
    console.log(`  AEGIS Health Check #${checkNumber} — ${new Date().toISOString()}`);
    console.log(`${"═".repeat(70)}\n`);

    async function trackStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const start = Date.now();
        try {
            const result = await fn();
            stepMetrics.push({ step: name, durationMs: Date.now() - start, status: "success" });
            return result;
        } catch (error) {
            stepMetrics.push({
                step: name,
                durationMs: Date.now() - start,
                status: "failed",
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    const config = runtime.getConfig();

    try {
        const clients = createClients(config.chains);
        const ethClient = clients.get("ethereum");

        // ── Step 1: Load Confidential Policy ──────────────────────────────────
        const policyHash = await trackStep("Load Policy", async () => {
            console.log("[Step 1/10] Loading confidential policy...");
            await runtime.getSecret("AEGIS_POLICY_KEY");
            const hash = generatePolicyHash(config.policy);
            console.log(`  Policy v${config.policy.version} loaded. Hash: ${hash.substring(0, 18)}...`);
            return hash;
        });

        // ── Step 2: Read Protocol State ───────────────────────────────────────
        const protocolReports = await trackStep("Read Protocol State", async () => {
            console.log("[Step 2/10] Fetching protocol metrics across chains (Parallel)...");
            const safeFetch = async (name: string, fn: () => Promise<ProtocolAdapterResult[]>) => {
                const start = Date.now();
                try {
                    const result = await withTimeout(fn(), 3500);
                    adapterLatency[name] = Date.now() - start;
                    console.log(`  [${name}] Fetched in ${adapterLatency[name]}ms`);
                    return result;
                } catch (e) {
                    adapterLatency[name] = Date.now() - start;
                    console.error(`  [${name}] FAILED:`, (e as Error).message);
                    return [];
                }
            };

            const [aaveReports, compoundReports, uniswapReports, makerReports, lidoReports] =
                await Promise.all([
                    safeFetch("Aave", () => fetchAaveMultichain(clients)),
                    safeFetch("Compound", () => fetchCompoundMultichain(clients)),
                    safeFetch("Uniswap", () => fetchUniswapMultichain(clients)),
                    safeFetch("Maker", () => fetchMakerMultichain(clients)),
                    safeFetch("Lido", () => fetchLidoMultichain(clients)),
                ]);

            const metrics: ProtocolAdapterResult[] = [
                ...aaveReports,
                ...compoundReports,
                ...uniswapReports,
                ...makerReports,
                ...lidoReports,
            ];

            if (metrics.length === 0) {
                const cached = getCachedProtocols();
                if (cached) {
                    console.warn("[AEGIS] Using cached protocol metrics (RPC degraded).");
                    return cached.protocols.map((m) => ({
                        ...m,
                        details: markDegraded(m.details, "protocol-adapter-cache"),
                    }));
                }
            }

            setCachedProtocols(metrics);
            return metrics;
        });

        const toProtocolMetrics = (result: ProtocolAdapterResult): ProtocolMetrics => ({
            protocol: result.name,
            chain: result.chain,
            claimedReserves: result.claimed,
            actualReserves: result.actual,
            solvencyRatio: result.solvencyRatioBps / 10_000,
            utilization: result.utilizationBps / 10_000,
            timestamp: result.timestamp * 1000,
        });

        const allMetrics = protocolReports.map(toProtocolMetrics);

        // ── Step 3: Read Chainlink Price Feeds ────────────────────────────────
        const prices = await trackStep("Read Chainlink Feeds", async () => {
            if (!ethClient) {
                return { ethUsd: { price: 3000, source: "cache" }, usdcUsd: { price: 1, source: "cache" } } as any;
            }
            return fetchPriceFeeds(ethClient, config.priceFeeds, "ethereum");
        });
        if (prices.ethUsd.source === "cache" || prices.usdcUsd.source === "cache") {
            console.warn("[AEGIS] Price feed degraded. Using cached values.");
        }

        // ── Step 4: Compute Utilization ──────────────────────────────────────
        const utilization = await trackStep("Compute Utilization", async () => {
            const totalClaimed = allMetrics.reduce((s, m) => s + m.claimedReserves, 0);
            const totalActual = allMetrics.reduce((s, m) => s + m.actualReserves, 0);
            const globalRatio = totalClaimed > 0 ? totalActual / totalClaimed : 1;
            return { totalClaimed, totalActual, globalRatio };
        });

        // ── Step 5: Velocity Detection ────────────────────────────────────────
        const velocityAlerts = await trackStep("Compute Velocity", async () =>
            detectVelocity(allMetrics, config.policy.velocityThreshold)
        );

        // ── Step 6: Contagion Analysis ────────────────────────────────────────
        const contagion = await trackStep("Detect Contagion", async () =>
            detectContagion(velocityAlerts)
        );

        // ── Step 7: AI Risk Scoring ───────────────────────────────────────────
        const aiResponse: AIRiskResponse = await trackStep("Call AI Risk Engine", async () => {
            const start = Date.now();
            const avgUtil = allMetrics.length
                ? allMetrics.reduce((s, m) => s + m.utilization, 0) / allMetrics.length
                : 0;
            const res = await callAIAnalysisService(config.aiServiceUrl, {
                price: prices.ethUsd.price,
                volatility: Math.abs(prices.ethUsd.price - 3000) / 3000,
                utilization: avgUtil,
                contagionScore: contagion.riskAdjustment,
            });
            aiLatency = Date.now() - start;
            console.log(`[AI-AGENT] Analysis generated. Score: ${res.riskScore}`);
            return res;
        });

        // ── Step 8: Compute Risk Score ────────────────────────────────────────
        const cascade = simulateCascade(allMetrics);
        const scoringResult = await trackStep("Compute Risk Score", async () =>
            calculateFinalScore({
                metrics: allMetrics,
                velocityAlerts,
                contagion,
                cascade,
                aiResponse,
                tvlData: [] as TVLData[],
            })
        );

        // ── Step 9: Encode Report Payload ─────────────────────────────────────
        const reportPayload = await trackStep("Encode Report Payload", async () =>
            encodeRiskReportPayload({
                totalReservesUSD: utilization.totalActual,
                totalClaimedUSD: utilization.totalClaimed,
                globalRatio: utilization.globalRatio,
                riskScore: scoringResult.finalScore,
                timestamp: Date.now(),
                checkNumber,
                severity: scoringResult.severity,
                anomalyDetected: contagion.riskAdjustment > 0.2 || scoringResult.severity === "CRITICAL",
                policyHash,
            })
        );

        // ── Step 10: Submit Report ────────────────────────────────────────────
        let txHash: string | undefined;
        await trackStep("Submit Report", async () => {
            console.log("[Step 10/10] Submitting on-chain report...");
            if (!ethClient) {
                console.warn("[AEGIS] No Ethereum client configured. Skipping on-chain write.");
                return;
            }

            const severityChanged =
                previousSubmittedSeverity === null ||
                previousSubmittedSeverity !== scoringResult.severity;
            const scoreDelta =
                previousSubmittedRiskScore === null
                    ? Number.POSITIVE_INFINITY
                    : Math.abs(scoringResult.finalScore - previousSubmittedRiskScore);
            const shouldSubmit = severityChanged || scoreDelta > 5;

            if (!shouldSubmit) {
                console.log(
                    `[AEGIS] Skipping on-chain submit (severity unchanged, score delta ${scoreDelta.toFixed(2)} <= 5)`
                );
                return;
            }

            try {
                txHash = await ethClient.writeReport({
                    contractAddress: config.riskOracleAddress,
                    payload: reportPayload,
                    protocolReports: protocolReports.map((m) => ({
                        name: m.name,
                        chain: m.chain,
                        claimed: BigInt(Math.floor(m.claimed)),
                        actual: BigInt(Math.floor(m.actual)),
                        solvencyRatioBps: BigInt(Math.floor(m.solvencyRatioBps)),
                        utilizationBps: BigInt(Math.floor(m.utilizationBps)),
                        timestamp: BigInt(Math.floor(m.timestamp)),
                    })),
                });
                previousSubmittedSeverity = scoringResult.severity;
                previousSubmittedRiskScore = scoringResult.finalScore;
                console.log(`  Oracle Update Submitted: ${txHash}`);
            } catch (error) {
                console.error("[AEGIS] On-chain submit failed. Continuing workflow.", error);
            }
        });

        const finalReport: RiskReport = {
            reportId: `AEGIS-${checkNumber}-${Date.now()}`,
            timestamp: Date.now(),
            checkNumber,
            ethPrice: prices.ethUsd.price,
            totalReservesUSD: utilization.totalActual,
            totalClaimedUSD: utilization.totalClaimed,
            globalRatio: utilization.globalRatio,
            anomalyDetected: contagion.riskAdjustment > 0.2 || scoringResult.severity === "CRITICAL",
            protocols: allMetrics,
            velocityAlerts,
            contagion,
            cascade,
            aiRiskScore: aiResponse.riskScore,
            aiConfidence: aiResponse.confidenceScore,
            aiExplanation: aiResponse.riskExplanation,
            finalRiskScore: scoringResult.finalScore,
            severity: scoringResult.severity,
            policyHash,
            riskWeights: aiResponse.featureWeights,
            txHash,
        };

        await sendDiscordAlert(config.discordWebhookUrl, {
            riskScore: finalReport.finalRiskScore,
            severity: finalReport.severity,
            protocolCoverage: config.protocols,
            chainCoverage: config.chains.map(c => c.name),
            velocityAlerts,
            contagion,
            cascade,
            policyHash,
            txHash,
        });

        const totalDurationMs = Date.now() - workflowStart;
        console.log(`\n[AEGIS] Cycle Complete in ${totalDurationMs}ms | Score: ${finalReport.finalRiskScore} (${finalReport.severity})`);

        return {
            riskReport: finalReport,
            metrics: {
                totalDurationMs,
                stepMetrics,
                adapterLatency,
                aiLatency,
            },
            alerts: [],
            compliance: {
                policyHash,
                riskScore: finalReport.finalRiskScore,
                timestamp: finalReport.timestamp,
                checkNumber: finalReport.checkNumber,
            },
        };

    } catch (error) {
        console.error("\n[CRITICAL] Workflow execution failed:", error);
        throw error;
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────

async function callAIAnalysisService(url: string, input: any): Promise<AIRiskResponse> {
    try {
        const response = await fetch(`${url}/risk-score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (response.ok) {
            const data = await response.json();
            return {
                riskScore: data.riskScore,
                confidenceScore: 0.92,
                riskExplanation: data.explanation ?? "AI risk assessment",
                featureWeights: {},
            };
        }
    } catch (e) { }
    return {
        riskScore: 25,
        confidenceScore: 0.6,
        riskExplanation: "AI fallback: degraded signal path",
        featureWeights: {}
    };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
}
