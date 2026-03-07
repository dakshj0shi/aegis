// ─── Cross-Chain Contagion Detection ────────────────────────────────────────
// Detects when stress signals appear simultaneously across multiple chains,
// indicating systemic risk propagation.

import { VelocityAlert, ContagionResult, Chain } from "../../types";
import { getAffectedChains } from "./velocity";

/**
 * Detect cross-chain contagion from velocity alerts.
 *
 * Logic:
 *   - 0-1 chains affected → NONE
 *   - 2 chains affected   → MODERATE (+15 risk)
 *   - 3+ chains affected  → SEVERE   (+25 risk)
 */
export function detectContagion(
    velocityAlerts: VelocityAlert[]
): ContagionResult {
    const affectedChains = getAffectedChains(velocityAlerts);
    const chainCount = affectedChains.length;

    if (chainCount >= 3) {
        console.log(
            `[Contagion] 🔴 SEVERE: ${chainCount} chains affected — ${affectedChains.join(", ")}`
        );
        return {
            chainsAffected: affectedChains,
            contagionLevel: "SEVERE",
            riskAdjustment: 25,
            details: `Severe cross-chain contagion detected across ${chainCount} chains: ${affectedChains.join(", ")}. Systemic risk escalated.`,
        };
    }

    if (chainCount === 2) {
        console.log(
            `[Contagion] 🟡 MODERATE: ${chainCount} chains affected — ${affectedChains.join(", ")}`
        );
        return {
            chainsAffected: affectedChains,
            contagionLevel: "MODERATE",
            riskAdjustment: 15,
            details: `Moderate contagion detected across 2 chains: ${affectedChains.join(", ")}. Monitoring escalated.`,
        };
    }

    return {
        chainsAffected: affectedChains,
        contagionLevel: "NONE",
        riskAdjustment: 0,
        details:
            chainCount === 1
                ? `Isolated stress on ${affectedChains[0]}. No cross-chain contagion.`
                : "No cross-chain contagion detected. All chains healthy.",
    };
}

/**
 * Analyze contagion patterns over time for trend detection.
 * Returns escalation recommendation.
 */
export function analyzeContagionTrend(
    history: ContagionResult[]
): {
    trending: "STABLE" | "ESCALATING" | "DE_ESCALATING";
    consecutiveSevere: number;
} {
    if (history.length < 2) {
        return { trending: "STABLE", consecutiveSevere: 0 };
    }

    let consecutiveSevere = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].contagionLevel === "SEVERE") {
            consecutiveSevere++;
        } else {
            break;
        }
    }

    const recentRisk = history.slice(-3).reduce((sum, h) => sum + h.riskAdjustment, 0);
    const priorRisk = history.slice(-6, -3).reduce((sum, h) => sum + h.riskAdjustment, 0);

    let trending: "STABLE" | "ESCALATING" | "DE_ESCALATING" = "STABLE";
    if (recentRisk > priorRisk + 10) trending = "ESCALATING";
    else if (recentRisk < priorRisk - 10) trending = "DE_ESCALATING";

    return { trending, consecutiveSevere };
}
