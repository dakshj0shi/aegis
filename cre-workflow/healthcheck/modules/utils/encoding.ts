// ─── Encoding Utilities ─────────────────────────────────────────────────────
// ABI encoding/decoding helpers for on-chain report submission.

import { encodeAbiParameters, parseAbiParameters } from "viem";
import { RiskReport, Severity, ComplianceAttestation } from "../../types";

/**
 * Encode a risk report for RiskOracle.submitReport() call.
 */
export function encodeRiskReport(report: RiskReport): string {
    // ABI encode: (uint256 riskScore, uint8 severity, uint256 timestamp, bytes32 policyHash)
    const severityEnum = severityToUint(report.severity);
    const timestamp = Math.floor(report.timestamp / 1000);

    // Simplified ABI encoding (in production, use ethers.AbiCoder)
    const encoded = [
        padUint256(report.finalRiskScore),
        padUint256(severityEnum),
        padUint256(timestamp),
        padBytes32(report.policyHash),
    ].join("");

    return "0x" + encoded;
}

/**
 * Encode canonical risk report payload for RiskOracle.onReport().
 */
export function encodeRiskReportPayload(payload: {
    totalReservesUSD: number;
    totalClaimedUSD: number;
    globalRatio: number;
    riskScore: number;
    timestamp: number;
    checkNumber: number;
    severity: Severity;
    anomalyDetected: boolean;
    policyHash: string;
}): `0x${string}` {
    const encoded = encodeAbiParameters(
        parseAbiParameters(
            "uint256 totalReservesUSD, uint256 totalClaimedUSD, uint256 globalRatioBps, uint256 riskScore, uint256 timestamp, uint256 checkNumber, uint8 severity, bool anomalyDetected, bytes32 policyHash"
        ),
        [
            BigInt(Math.floor(payload.totalReservesUSD)),
            BigInt(Math.floor(payload.totalClaimedUSD)),
            BigInt(Math.floor(payload.globalRatio * 10_000)),
            BigInt(payload.riskScore),
            BigInt(Math.floor(payload.timestamp / 1000)),
            BigInt(payload.checkNumber),
            severityToUint(payload.severity),
            payload.anomalyDetected,
            payload.policyHash as `0x${string}`,
        ]
    );

    return encoded;
}

/**
 * Encode AegisGuard update call data.
 */
export function encodeGuardUpdate(
    riskScore: number,
    severity: Severity
): string {
    const severityEnum = severityToUint(severity);

    const encoded = [
        padUint256(riskScore),
        padUint256(severityEnum),
    ].join("");

    return "0x" + encoded;
}

/**
 * Encode compliance attestation for AttestationRegistry.
 */
export function encodeAttestation(attestation: ComplianceAttestation): string {
    const encoded = [
        padBytes32(attestation.policyHash),
        padUint256(attestation.riskScore),
        padUint256(attestation.timestamp),
        padUint256(attestation.checkNumber),
    ].join("");

    return "0x" + encoded;
}

/**
 * Convert severity string to Solidity enum uint.
 */
function severityToUint(severity: Severity): number {
    const map: Record<Severity, number> = {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        CRITICAL: 3,
    };
    return map[severity];
}

/**
 * Pad number to 32-byte hex (uint256).
 */
function padUint256(value: number): string {
    return BigInt(value).toString(16).padStart(64, "0");
}

/**
 * Pad bytes32 hex string (strip 0x prefix if present).
 */
function padBytes32(hex: string): string {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    return clean.padStart(64, "0");
}

/**
 * Decode a bytes32 hex string to its UTF-8 content.
 */
export function decodeBytes32(hex: string): string {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    let str = "";
    for (let i = 0; i < clean.length; i += 2) {
        const code = parseInt(clean.substring(i, i + 2), 16);
        if (code === 0) break;
        str += String.fromCharCode(code);
    }
    return str;
}
