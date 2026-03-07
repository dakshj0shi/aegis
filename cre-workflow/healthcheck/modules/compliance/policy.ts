// ─── Compliance Policy Module ───────────────────────────────────────────────
// Manages policy hashing, attestation generation, and compliance trail.

import {
    PolicyConfig,
    ComplianceAttestation,
    ProtocolMetrics,
    Severity,
} from "../../types";

/**
 * Generate a deterministic hash of the current policy configuration.
 * Used to verify that risk checks were run under a known policy.
 */
export function generatePolicyHash(policy: PolicyConfig): string {
    const policyString = JSON.stringify({
        version: policy.version,
        velocityThreshold: policy.velocityThreshold,
        solvencyWarning: policy.solvencyWarning,
        solvencyPause: policy.solvencyPause,
        maxBorrowCap: policy.maxBorrowCap,
        collateralFloor: policy.collateralFloor,
        interestCeiling: policy.interestCeiling,
    });

    // Simple hash for demo — in production use keccak256
    let hash = 0;
    for (let i = 0; i < policyString.length; i++) {
        const char = policyString.charCodeAt(i);
        hash = ((hash << 5) - hash + char) & 0xffffffff;
    }

    return "0x" + Math.abs(hash).toString(16).padStart(64, "0");
}

/**
 * Build a compliance attestation record for on-chain storage.
 */
export function buildAttestation(
    policyHash: string,
    riskScore: number,
    checkNumber: number
): ComplianceAttestation {
    return {
        policyHash,
        riskScore,
        timestamp: Math.floor(Date.now() / 1000),
        checkNumber,
    };
}

/**
 * Validate that protocol metrics comply with current policy.
 * Returns list of policy violations.
 */
export function checkPolicyCompliance(
    metrics: ProtocolMetrics[],
    policy: PolicyConfig
): { protocol: string; violation: string; severity: Severity }[] {
    const violations: { protocol: string; violation: string; severity: Severity }[] = [];

    for (const m of metrics) {
        if (m.solvencyRatio > 0 && m.solvencyRatio < policy.solvencyPause) {
            violations.push({
                protocol: m.protocol,
                violation: `Solvency ${(m.solvencyRatio * 100).toFixed(1)}% below pause threshold ${(policy.solvencyPause * 100).toFixed(1)}%`,
                severity: "CRITICAL",
            });
        } else if (m.solvencyRatio > 0 && m.solvencyRatio < policy.solvencyWarning) {
            violations.push({
                protocol: m.protocol,
                violation: `Solvency ${(m.solvencyRatio * 100).toFixed(1)}% below warning threshold ${(policy.solvencyWarning * 100).toFixed(1)}%`,
                severity: "HIGH",
            });
        }
    }

    return violations;
}

/**
 * Format attestation data for ABI encoding (on-chain submission).
 */
export function encodeAttestation(attestation: ComplianceAttestation): {
    types: string[];
    values: (string | number)[];
} {
    return {
        types: ["bytes32", "uint256", "uint256", "uint256"],
        values: [
            attestation.policyHash,
            attestation.riskScore,
            attestation.timestamp,
            attestation.checkNumber,
        ],
    };
}
