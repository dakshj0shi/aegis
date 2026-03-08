/**
 * AEGIS AI Risk Engine v2.0.0
 * Institutional Risk Assessment Service
 */

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ─── Configuration ─────────────────────────────────────────────────────────

const FEATURE_CONFIG = {
    velocity: { weight: 0.25, label: "Liquidity Velocity" },
    solvency: { weight: 0.35, label: "Reserve Solvency" },
    contagion: { weight: 0.20, label: "Chain Contagion" },
    cascade: { weight: 0.15, label: "Liquidation Cascade" },
    volatility: { weight: 0.05, label: "Market Volatility" },
};

// ─── Core Logic ────────────────────────────────────────────────────────────

/**
 * Calculates a multi-vector risk score.
 */
function processRiskAnalysis(data) {
    const { velocity, solvency, contagion, cascadeRisk, tvlVolatility } = data;

    // 1. Calculate raw vector scores (0-100)
    const scores = {
        velocity: Math.min(100, velocity * 400),        // Utilization spike factor
        solvency: Math.min(100, (1 - solvency) * 500),  // Solvency drop factor
        contagion: Math.min(100, contagion * 100),      // Cross-chain spread
        cascade: Math.min(100, cascadeRisk * 100),      // Propagation probability
        volatility: Math.min(100, tvlVolatility * 200), // Asset instability
    };

    // 2. Weighted Aggregation
    let riskScore = 0;
    Object.keys(FEATURE_CONFIG).forEach(key => {
        riskScore += (scores[key] || 0) * FEATURE_CONFIG[key].weight;
    });

    // 3. Systemic Amplification
    // If multiple vectors are high, the risk is non-linear
    const highRiskCount = Object.values(scores).filter(s => s > 70).length;
    if (highRiskCount >= 2) riskScore *= 1.2;

    riskScore = Math.min(100, Math.round(riskScore));

    // 4. Confidence Scoring
    // Confidence reduces during extreme volatility or missing data
    let confidenceScore = 0.96;
    if (riskScore > 80) confidenceScore -= 0.1;
    if (velocity > 0.4) confidenceScore -= 0.05;

    return {
        riskScore,
        confidenceScore: parseFloat(confidenceScore.toFixed(2)),
        riskExplanation: generateExplanation(riskScore, scores),
        featureWeights: FEATURE_CONFIG,
        vectorScores: scores,
        timestamp: new Date().toISOString()
    };
}

function mapScorePayload(payload) {
    const utilization = Math.max(0, Math.min(1, payload.utilization ?? 0));
    const contagionScore = Math.max(0, Math.min(1, payload.contagionScore ?? 0));
    const volatility = Math.max(0, Math.min(1, payload.volatility ?? 0));

    return {
        velocity: utilization,
        solvency: 1 - utilization,
        contagion: contagionScore,
        cascadeRisk: contagionScore * 0.7,
        tvlVolatility: volatility,
    };
}

function generateExplanation(score, vectors) {
    if (score < 30) return "Global liquidity signals are stable. No systemic shocks detected.";
    if (score < 60) return "Elevated volatility detected in utilitzation vectors. Monitoring cross-chain nodes for contagion.";

    const peak = Object.keys(vectors).reduce((a, b) => vectors[a] > vectors[b] ? a : b);
    return `CRITICAL: Systemic stress detected. Peak risk vector: ${FEATURE_CONFIG[peak].label}. Recommend immediate circuit breaker activation.`;
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

/**
 * Legacy support for basic scoring
 */
app.post("/risk-score", (req, res) => {
    const analysis = processRiskAnalysis(mapScorePayload(req.body));
    res.json({
        riskScore: analysis.riskScore,
        explanation: analysis.riskExplanation
    });
});

/**
 * High-fidelity risk analysis for AEGIS Dashboard
 */
app.post("/risk-analysis", (req, res) => {
    try {
        const analysis = processRiskAnalysis(req.body);
        console.log(`[AI] Analysis generated. Score: ${analysis.riskScore} | Confidence: ${analysis.confidenceScore}`);
        res.json(analysis);
    } catch (error) {
        res.status(400).json({ error: "Invalid payload components" });
    }
});

function toExposure(riskScore) {
    if (riskScore >= 75) return "high";
    if (riskScore >= 45) return "medium";
    return "low";
}

function toTrend(riskScore) {
    if (riskScore >= 75) return "deteriorating";
    if (riskScore >= 45) return "elevated";
    return "stable";
}

function buildRiskResponse(analysis) {
    const volatility = Number((analysis.vectorScores.volatility / 100).toFixed(2));
    const cascadeProbability = Math.min(95, Math.round(analysis.vectorScores.cascade * 0.85));
    const nextRiskWindow =
        analysis.riskScore >= 75 ? "HIGH" :
            analysis.riskScore >= 45 ? "MEDIUM" :
                "LOW";

    return {
        riskScore: analysis.riskScore,
        confidence: analysis.confidenceScore,
        exposure: toExposure(analysis.riskScore),
        volatility,
        trend: toTrend(analysis.riskScore),
        forecast:
            analysis.riskScore >= 75 ? "Elevated" :
                analysis.riskScore >= 45 ? "Watchlist" :
                    "Stable",
        nextRiskWindow,
        cascadeProbability,
    };
}

/**
 * Standardized API for dashboard polling.
 */
app.get("/api/risk", (_req, res) => {
    const analysis = processRiskAnalysis({
        velocity: 0.18,
        solvency: 0.91,
        contagion: 0.21,
        cascadeRisk: 0.19,
        tvlVolatility: 0.12,
    });
    res.json(buildRiskResponse(analysis));
});

app.post("/api/risk", (req, res) => {
    try {
        const mapped = req.body?.velocity !== undefined
            ? req.body
            : mapScorePayload(req.body ?? {});
        const analysis = processRiskAnalysis(mapped);
        res.json(buildRiskResponse(analysis));
    } catch (error) {
        res.status(400).json({ error: "Invalid risk payload" });
    }
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        version: "2.0.0",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
    });
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🧠 AI Risk Engine v2.0.0 responsive on port ${PORT}`);
});
