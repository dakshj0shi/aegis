// ─── AEGIS Workflow Definition ──────────────────────────────────────────────
// Chainlink CRE Workflow: 60-second interval health check pipeline.

import { WorkflowConfig, RiskReport, ProtocolMetrics, TVLData, Severity, AIRiskResponse } from "./types";
import { EVMClient, createClients } from "./modules/evm/client";
import { fetchAaveMultichain } from "./modules/protocols/aave";
import { fetchCompoundMultichain } from "./modules/protocols/compound";

import { fetchUniswapMultichain } from "./modules/protocols/uniswap";
import { fetchMakerMultichain } from "./modules/protocols/maker";
import { detectVelocity } from "./modules/risk/velocity";
import { detectContagion } from "./modules/risk/contagion";
import { simulateCascade } from "./modules/risk/cascade";
import { calculateFinalScore } from "./modules/risk/scoring";
import { generatePolicyHash, buildAttestation } from "./modules/compliance/policy";
import { sendDiscordAlert } from "./modules/alerts/discord";
import { encodeRiskReport, encodeGuardUpdate, encodeAttestation } from "./modules/utils/encoding";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowRuntime {
    getSecret: (key: string) => Promise<string>;
    getConfig: () => WorkflowConfig;
}

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
        // ── Step 1: Load Confidential Policy ──────────────────────────────────
        const policyHash = await trackStep("Load Policy", async () => {
            console.log("[Step 1/14] Loading confidential policy...");
            await runtime.getSecret("AEGIS_POLICY_KEY");
            const hash = generatePolicyHash(config.policy);
            console.log(`  Policy v${config.policy.version} loaded. Hash: ${hash.substring(0, 18)}...`);
            return hash;
        });

        // ── Step 2: Fetch ETH Price ───────────────────────────────────────────
        const { clients, ethClient } = await trackStep("Initialize Clients", async () => {
            console.log("[Step 2/14] Fetching network context...");
            const clients = createClients(config.chains);
            const ethClient = clients.get("ethereum");
            return { clients, ethClient };
        });

        // ── Step 3: Fetch Protocol Metrics ────────────────────────────────────
        const allMetrics = await trackStep("Fetch Protocol Metrics", async () => {
            console.log("[Step 3/14] Fetching protocol metrics across chains (Parallel)...");
            const fetchers = [
                { name: "Aave", fn: () => fetchAaveMultichain(clients) },
                { name: "Compound", fn: () => fetchCompoundMultichain(clients) },

                { name: "Uniswap", fn: () => fetchUniswapMultichain(clients) },
                { name: "Maker", fn: () => fetchMakerMultichain(clients) },
            ];

            const settled = await Promise.allSettled(
                fetchers.map(async ({ name, fn }) => {
                    const start = Date.now();
                    try {
                        const res = await withTimeout(fn(), 15000);
                        adapterLatency[name] = Date.now() - start;
                        console.log(`  [${name}] Fetched in ${adapterLatency[name]}ms`);
                        return res;
                    } catch (e) {
                        console.error(`  [${name}] FAILED:`, (e as Error).message);
                        adapterLatency[name] = Date.now() - start;
                        return [];
                    }
                })
            );

            const metrics: ProtocolMetrics[] = [];
            settled.forEach((res) => {
                if (res.status === "fulfilled") metrics.push(...res.value);
            });
            return metrics;
        });

        // ── Step 4: Off-Chain TVL ─────────────────────────────────────────────
        const tvlData = await trackStep("DeFiLlama TVL", () => fetchDeFiLlamaTVL(config.protocols));

        // ── Step 5: Velocity Detection ────────────────────────────────────────
        const velocityAlerts = detectVelocity(allMetrics, config.policy.velocityThreshold);

        // ── Step 6: Contagion Analysis ────────────────────────────────────────
        const contagion = detectContagion(velocityAlerts);

        // ── Step 7: Cascade Simulation ───────────────────────────────────────
        const cascade = simulateCascade(allMetrics);

        // ── Step 8: AI Risk Scoring ───────────────────────────────────────────
        const aiResponse: AIRiskResponse = await trackStep("AI Risk Scoring", async () => {
            const start = Date.now();
            const res = await callAIAnalysisService(config.aiServiceUrl, {
                velocity: velocityAlerts.filter(a => a.triggered).length / (velocityAlerts.length || 1),
                solvency: avgSolvency(allMetrics),
                contagion: contagion.riskAdjustment,
                cascadeRisk: cascade.cascadeRiskScore,
                tvlVolatility: avgTvlChange(tvlData), // mapping tvl change to volatility for simulation
            });
            aiLatency = Date.now() - start;
            console.log(`[AI-AGENT] Analysis generated. Confidence: ${res.confidenceScore * 100}% | Score: ${res.riskScore}`);
            return res;
        });

        // ── Step 9: Final Score Aggregation ───────────────────────────────────
        const scoringResult = calculateFinalScore({
            metrics: allMetrics,
            velocityAlerts,
            contagion,
            cascade,
            aiResponse,
            tvlData,
        });

        // ── Step 10: Generate Report ──────────────────────────────────────────
        const finalReport: RiskReport = {
            reportId: `AEGIS-${checkNumber}-${Date.now()}`,
            timestamp: Date.now(),
            checkNumber,
            ethPrice: 3000,
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
            riskWeights: aiResponse.featureWeights
        };

        // ── Step 11/12/13: On-Chain Enforcement (Simulated for Demo) ─────────
        await trackStep("Contract Updates", async () => {
            console.log("[Step 11-13/14] Updating on-chain state...");
            if (ethClient) {
                // In production, real contract calls happen here
                const encoded = encodeRiskReport(finalReport);
                console.log(`  Oracle Update Prepared: ${encoded.substring(0, 42)}...`);
            }
        });

        // ── Step 14: Discord Sentinel ─────────────────────────────────────────
        await trackStep("Alert Dispatch", () => sendDiscordAlert(config.discordWebhookUrl, {
            riskScore: finalReport.finalRiskScore,
            severity: finalReport.severity,
            protocolCoverage: config.protocols,
            chainCoverage: config.chains.map(c => c.name),
            velocityAlerts,
            contagion,
            cascade,
            policyHash,
        }));

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
                checkNumber: finalReport.checkNumber
            },
        };

    } catch (error) {
        console.error("\n[CRITICAL] Workflow execution failed:", error);
        throw error;
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────

async function fetchDeFiLlamaTVL(protocols: string[]): Promise<TVLData[]> {
    const DEFILLAMA_API = "https://api.llama.fi/protocol";
    const results: TVLData[] = [];
    for (const protocol of protocols) {
        try {
            const response = await fetch(`${DEFILLAMA_API}/${protocol}`);
            if (response.ok) {
                const data = await response.json();
                results.push({
                    protocol,
                    tvl: data.currentChainTvls?.total ?? 0,
                    tvlChange24h: 0,
                });
            }
        } catch {
            results.push({ protocol, tvl: 0, tvlChange24h: 0 });
        }
    }
    return results;
}

async function callAIAnalysisService(url: string, input: any): Promise<AIRiskResponse> {
    try {
        const response = await fetch(`${url}/risk-analysis`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (response.ok) return await response.json();
    } catch (e) { }
    return {
        riskScore: 25,
        confidenceScore: 0.1,
        riskExplanation: "AI Fallback Engagement",
        featureWeights: {}
    };
}

function avgSolvency(metrics: ProtocolMetrics[]): number {
    const valid = metrics.filter(m => m.solvencyRatio > 0);
    return valid.length ? valid.reduce((s, m) => s + m.solvencyRatio, 0) / valid.length : 1;
}

function avgTvlChange(tvlData: TVLData[]): number {
    return tvlData.length ? tvlData.reduce((s, t) => s + t.tvlChange24h, 0) / tvlData.length : 0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
}
