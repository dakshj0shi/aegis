// ─── Velocity Detection Module ──────────────────────────────────────────────
// Tracks utilization change rate between consecutive checks.
// Alerts when velocity exceeds configured threshold.

import { ProtocolMetrics, VelocityAlert, Chain } from "../../types";

// In-memory store for previous utilization readings
const previousReadings: Map<string, number> = new Map();

/**
 * Calculate velocity (utilization delta) for each protocol-chain pair.
 * velocity = currentUtilization - previousUtilization
 * Alert if velocity ≥ threshold.
 */
export function detectVelocity(
    metrics: ProtocolMetrics[],
    threshold: number
): VelocityAlert[] {
    const alerts: VelocityAlert[] = [];

    for (const m of metrics) {
        const key = `${m.protocol}:${m.chain}`;
        const previousUtilization = previousReadings.get(key) ?? m.utilization;

        const velocity = m.utilization - previousUtilization;
        const triggered = Math.abs(velocity) >= threshold;

        alerts.push({
            protocol: m.protocol,
            chain: m.chain,
            previousUtilization,
            currentUtilization: m.utilization,
            velocity,
            threshold,
            triggered,
        });

        if (triggered) {
            console.log(
                `[Velocity] ⚠️ ALERT: ${m.protocol}@${m.chain} velocity=${(velocity * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`
            );
        }

        // Update stored reading for next cycle
        previousReadings.set(key, m.utilization);
    }

    return alerts;
}

/**
 * Get all chains that have at least one triggered velocity alert.
 */
export function getAffectedChains(alerts: VelocityAlert[]): Chain[] {
    const triggeredChains = new Set<Chain>();
    for (const alert of alerts) {
        if (alert.triggered) {
            triggeredChains.add(alert.chain);
        }
    }
    return Array.from(triggeredChains);
}

/**
 * Count the number of triggered alerts.
 */
export function countTriggeredAlerts(alerts: VelocityAlert[]): number {
    return alerts.filter((a) => a.triggered).length;
}

/**
 * Reset stored readings (for testing or workflow restart).
 */
export function resetReadings(): void {
    previousReadings.clear();
}
