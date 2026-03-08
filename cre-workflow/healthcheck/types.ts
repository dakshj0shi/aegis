// ─── AEGIS Type Definitions ─────────────────────────────────────────────────

export type Chain = "ethereum" | "arbitrum" | "base";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProtocolMetrics {
    protocol: string;
    chain: Chain;
    claimedReserves: number;
    actualReserves: number;
    solvencyRatio: number;
    utilization: number;
    timestamp: number;
}

export interface ProtocolAdapterResult {
    name: string;
    chain: Chain;
    claimed: number;
    actual: number;
    solvencyRatio: number;
    utilizationBps: number;
    details: Record<string, unknown>;
}

export interface VelocityAlert {
    protocol: string;
    chain: Chain;
    previousUtilization: number;
    currentUtilization: number;
    velocity: number;
    threshold: number;
    triggered: boolean;
}

export interface ContagionResult {
    chainsAffected: Chain[];
    contagionLevel: "NONE" | "MODERATE" | "SEVERE";
    riskAdjustment: number;
    details: string;
}

export interface CascadeResult {
    cascadeRiskScore: number;
    cascadeProbability: number;
    affectedProtocols: string[];
    estimatedLiquidityStress: number;
    severity: Severity;
}

export interface AIRiskResponse {
    riskScore: number;
    confidenceScore: number;
    riskExplanation: string;
    featureWeights: any;
}

export interface RiskReport {
    reportId: string;
    timestamp: number;
    checkNumber: number;
    ethPrice: number;
    totalReservesUSD?: number;
    totalClaimedUSD?: number;
    globalRatio?: number;
    anomalyDetected?: boolean;
    protocols: ProtocolMetrics[];
    velocityAlerts: VelocityAlert[];
    contagion: ContagionResult;
    cascade: CascadeResult;
    aiRiskScore: number;
    aiConfidence: number;
    aiExplanation: string;
    finalRiskScore: number;
    severity: Severity;
    policyHash: string;
    riskWeights?: any;
    txHash?: string;
}

export interface PolicyConfig {
    version: string;
    velocityThreshold: number;
    solvencyWarning: number;
    solvencyPause: number;
    maxBorrowCap: number;
    collateralFloor: number;
    interestCeiling: number;
}

export interface ChainConfig {
    name: Chain;
    rpcUrl: string;
    chainId: number;
    multicallAddress: string;
}

export interface PriceFeedConfig {
    ethUsd: Partial<Record<Chain, string>>;
    usdcUsd: Partial<Record<Chain, string>>;
}

export interface WorkflowConfig {
    chains: ChainConfig[];
    protocols: string[];
    riskOracleAddress: string;
    aegisGuardAddress: string;
    attestationRegistryAddress: string;
    policyEngineAddress: string;
    priceFeeds: PriceFeedConfig;
    aiServiceUrl: string;
    discordWebhookUrl: string;
    intervalSeconds: number;
    policy: PolicyConfig;
}

export interface ComplianceAttestation {
    policyHash: string;
    riskScore: number;
    timestamp: number;
    checkNumber: number;
}

export interface DiscordAlert {
    riskScore: number;
    severity: Severity;
    protocolCoverage: string[];
    chainCoverage: Chain[];
    velocityAlerts: VelocityAlert[];
    contagion: ContagionResult;
    cascade: CascadeResult;
    txHash?: string;
    policyHash: string;
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
    alerts: DiscordAlert[];
    compliance: ComplianceAttestation;
}

export interface TVLData {
    protocol: string;
    tvl: number;
    tvlChange24h: number;
}
