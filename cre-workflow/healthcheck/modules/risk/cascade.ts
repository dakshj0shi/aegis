/**
 * AEGIS Liquidity Cascade Simulation Engine
 * Modeling propagation of liquidity shocks across protocol dependencies.
 */

import { ProtocolMetrics, CascadeResult, Severity } from "../../types";

interface ProtocolDependency {
    source: string;
    target: string;
    strength: number; // Correlation / dependency multiplier
}

// ─── Institutional Dependency Graph ────────────────────────────────────────

const SYSTEM_DEPENDENCIES: ProtocolDependency[] = [
    { source: "lido", target: "aave", strength: 0.8 },      // stETH collateral risk
    { source: "uniswap", target: "maker", strength: 0.6 },  // LP collateral / Oracle stability
    { source: "aave", target: "compound", strength: 0.4 },  // Parallel lending stress
    { source: "maker", target: "aave", strength: 0.5 },    // DAI liquidity
];

/**
 * Advanced multi-step systemic failure simulation.
 */
export function simulateCascade(metrics: ProtocolMetrics[]): CascadeResult {
    const stressedProtocols = new Set<string>();
    const stressLevels: Record<string, number> = {};

    // 1. Initial Shock Detection
    metrics.forEach(m => {
        if (m.utilization > 0.85 || m.solvencyRatio < 0.90) {
            stressedProtocols.add(m.protocol.toLowerCase());
            stressLevels[m.protocol.toLowerCase()] = (m.utilization - 0.5) * 2;
        }
    });

    // 2. Cascade Propagation (Multi-step)
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 3) {
        changed = false;
        iterations++;

        SYSTEM_DEPENDENCIES.forEach(dep => {
            const sourceStress = stressLevels[dep.source] || 0;
            if (sourceStress > 0.4) {
                const transfer = sourceStress * dep.strength;
                const currentTargetStress = stressLevels[dep.target] || 0;

                if (transfer > currentTargetStress + 0.1) {
                    stressLevels[dep.target] = transfer;
                    stressedProtocols.add(dep.target);
                    changed = true;
                }
            }
        });
    }

    // 3. Institutional Logic: Cross-protocol threshold amplification
    const aaveMetrics = metrics.find(m => m.protocol.toLowerCase() === "aave");
    const compoundMetrics = metrics.find(m => m.protocol.toLowerCase() === "compound");

    let institutionalMultiplier = 0;
    if (aaveMetrics && aaveMetrics.utilization > 0.80 && compoundMetrics && compoundMetrics.utilization > 0.75) {
        institutionalMultiplier = 20; // +20 risk points
    }

    // 4. Impact Assessment
    let baseScore = Object.values(stressLevels).reduce((a, b) => a + b, 0) / 4;
    let cascadeRiskScore = Math.min(100, (baseScore * 100) + institutionalMultiplier);
    const estimatedLiquidityStress = (cascadeRiskScore / 100) * 1.5;

    let severity: Severity = "LOW";
    if (cascadeRiskScore > 70) severity = "CRITICAL";
    else if (cascadeRiskScore > 40) severity = "HIGH";
    else if (cascadeRiskScore > 15) severity = "MEDIUM";

    return {
        cascadeRiskScore: parseFloat(cascadeRiskScore.toFixed(2)),
        cascadeProbability: parseFloat((cascadeRiskScore / 100 * 0.8).toFixed(2)),
        affectedProtocols: Array.from(stressedProtocols).map(p => p.toUpperCase()),
        estimatedLiquidityStress: parseFloat(estimatedLiquidityStress.toFixed(2)),
        severity
    };
}
