// ─── Risk Scoring Module ────────────────────────────────────────────────────
// Aggregates all risk signals into a final normalized score (0–100).

import {
    ProtocolMetrics,
    VelocityAlert,
    ContagionResult,
    CascadeResult,
    AIRiskResponse,
    TVLData,
    Severity,
} from "../../types";

interface ScoringInput {
    metrics: ProtocolMetrics[];
    velocityAlerts: VelocityAlert[];
    contagion: ContagionResult;
    cascade: CascadeResult;
    aiResponse: AIRiskResponse;
    tvlData: TVLData[];
}

interface ScoringResult {
    finalScore: number;
    severity: Severity;
    components: {
        solvencyScore: number;
        velocityScore: number;
        contagionScore: number;
        cascadeScore: number;
        tvlScore: number;
        aiScore: number;
    };
}

// Weightings for final risk score calculation
const WEIGHTS = {
    solvency: 0.25,
    velocity: 0.15,
    contagion: 0.15,
    cascade: 0.20,
    tvl: 0.10,
    ai: 0.15,
};

/**
 * Calculate the final AEGIS risk score from all signal sources.
 * Score ranges from 0 (safe) to 100 (critical risk).
 */
export function calculateFinalScore(input: ScoringInput): ScoringResult {
    // 1. Solvency Score: average deviation from 100% solvency
    const solvencyRatios = input.metrics
        .filter((m) => m.solvencyRatio > 0)
        .map((m) => m.solvencyRatio);

    const avgSolvency =
        solvencyRatios.length > 0
            ? solvencyRatios.reduce((a, b) => a + b, 0) / solvencyRatios.length
            : 1;

    // Convert to risk: lower solvency = higher risk
    // 100% solvency = 0 risk, 80% solvency = 100 risk
    const solvencyScore = Math.min(100, Math.max(0, (1 - avgSolvency) * 500));

    // 2. Velocity Score: based on triggered alerts
    const triggeredCount = input.velocityAlerts.filter((a) => a.triggered).length;
    const totalAlerts = input.velocityAlerts.length;
    const velocityScore = totalAlerts > 0 ? (triggeredCount / totalAlerts) * 100 : 0;

    // 3. Contagion Score: direct from contagion detection
    const contagionScore = input.contagion.riskAdjustment * 4; // max 25 * 4 = 100

    // 4. Cascade Score: from cascade simulation (already normalized 0-100)
    const cascadeScore = input.cascade.cascadeRiskScore;

    // 5. TVL Score: based on negative TVL changes
    const tvlChanges = input.tvlData.map((t) => t.tvlChange24h);
    const avgTvlChange =
        tvlChanges.length > 0
            ? tvlChanges.reduce((a, b) => a + b, 0) / tvlChanges.length
            : 0;
    // Negative TVL change = higher risk
    const tvlScore = Math.min(100, Math.max(0, -avgTvlChange * 500));

    // 6. AI Score: directly from AI service
    const aiScore = input.aiResponse.riskScore;

    // Weighted final score
    const finalScore = Math.round(
        solvencyScore * WEIGHTS.solvency +
        velocityScore * WEIGHTS.velocity +
        contagionScore * WEIGHTS.contagion +
        cascadeScore * WEIGHTS.cascade +
        tvlScore * WEIGHTS.tvl +
        aiScore * WEIGHTS.ai
    );

    const clampedScore = Math.min(100, Math.max(0, finalScore));
    const severity = scoreToseverity(clampedScore);

    console.log(
        `[Scoring] Final Risk Score: ${clampedScore}/100 (${severity}) ` +
        `[Solvency: ${solvencyScore.toFixed(1)}, Velocity: ${velocityScore.toFixed(1)}, ` +
        `Contagion: ${contagionScore.toFixed(1)}, Cascade: ${cascadeScore.toFixed(1)}, ` +
        `TVL: ${tvlScore.toFixed(1)}, AI: ${aiScore.toFixed(1)}]`
    );

    return {
        finalScore: clampedScore,
        severity,
        components: {
            solvencyScore,
            velocityScore,
            contagionScore,
            cascadeScore,
            tvlScore,
            aiScore,
        },
    };
}

/**
 * Map numeric risk score to severity level.
 */
function scoreToseverity(score: number): Severity {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
}

/**
 * Generate human-readable risk summary.
 */
export function generateRiskSummary(result: ScoringResult): string {
    const lines: string[] = [
        `AEGIS Risk Report — Score: ${result.finalScore}/100 (${result.severity})`,
        `──────────────────────────────────────`,
        `Solvency:  ${result.components.solvencyScore.toFixed(1)}/100 (weight: ${WEIGHTS.solvency * 100}%)`,
        `Velocity:  ${result.components.velocityScore.toFixed(1)}/100 (weight: ${WEIGHTS.velocity * 100}%)`,
        `Contagion: ${result.components.contagionScore.toFixed(1)}/100 (weight: ${WEIGHTS.contagion * 100}%)`,
        `Cascade:   ${result.components.cascadeScore.toFixed(1)}/100 (weight: ${WEIGHTS.cascade * 100}%)`,
        `TVL Delta: ${result.components.tvlScore.toFixed(1)}/100 (weight: ${WEIGHTS.tvl * 100}%)`,
        `AI Score:  ${result.components.aiScore.toFixed(1)}/100 (weight: ${WEIGHTS.ai * 100}%)`,
    ];

    return lines.join("\n");
}
