// ─── Discord Alert Module ───────────────────────────────────────────────────
// Sends formatted risk alert embeds to Discord via webhook.

import {
    DiscordAlert,
    Severity,
    VelocityAlert,
    ContagionResult,
    CascadeResult,
} from "../../types";

// Severity color mapping (Discord embed colors)
const SEVERITY_COLORS: Record<Severity, number> = {
    LOW: 0x556b2f, // Olive green — safe
    MEDIUM: 0xffa500, // Orange — caution
    HIGH: 0xff4500, // Red-orange — danger
    CRITICAL: 0xff0000, // Red — critical
};

const SEVERITY_EMOJI: Record<Severity, string> = {
    LOW: "🟢",
    MEDIUM: "🟡",
    HIGH: "🟠",
    CRITICAL: "🔴",
};

export async function sendDiscordAlert(
    webhookUrl: string,
    alert: DiscordAlert
): Promise<boolean> {
    const severity = getSeverityFromScore(alert.riskScore);
    const emoji = SEVERITY_EMOJI[severity];
    const color = SEVERITY_COLORS[severity];

    const triggeredAlerts = alert.velocityAlerts.filter((a) => a.triggered);

    const embed = {
        embeds: [
            {
                title: `${emoji} AEGIS SECURITY ENFORCEMENT — ${severity}`,
                description: `**Autonomous detection system identified state of potential instability.**\n\n` +
                    `>>> *Action Policy Applied:* ${severity === 'CRITICAL' ? 'Global Pause Triggered' : 'Monitoring Escalated'}`,
                color,
                fields: [
                    {
                        name: "🎯 RISK INDEX",
                        value: `\`${alert.riskScore}/100\``,
                        inline: true,
                    },
                    {
                        name: "🔍 SEVERITY",
                        value: `**${severity}**`,
                        inline: true,
                    },
                    {
                        name: "📋 POLICY",
                        value: `\`${alert.policyHash.substring(0, 8)}...\``,
                        inline: true,
                    },
                    {
                        name: "⚡ VELOCITY & LIQUIDITY SHOCKS",
                        value: formatVelocityAlerts(triggeredAlerts),
                        inline: false,
                    },
                    {
                        name: "🌐 CONTAGION",
                        value: `Level: **${alert.contagion.contagionLevel}**\nChains: ${alert.contagion.chainsAffected.join(", ") || "None"}`,
                        inline: true,
                    },
                    {
                        name: "💥 CASCADE PROPAGATION",
                        value: `Probability: **${(alert.cascade.cascadeProbability * 100).toFixed(0)}%**\nDrain: **-${(alert.cascade.estimatedLiquidityStress * 100).toFixed(1)}%**\nNodes: ${alert.cascade.affectedProtocols.join(", ") || "None"}`,
                        inline: true,
                    },
                ],
                footer: {
                    text: `AEGIS System v1.2.0 • DON Check #${Date.now().toString().slice(-4)}`,
                },
                timestamp: new Date().toISOString(),
            },
        ],
    };

    if (alert.txHash) {
        embed.embeds[0].fields.push({
            name: "🔗 ON-CHAIN EVIDENCE",
            value: `[View Circuit Breaker Update](https://etherscan.io/tx/${alert.txHash})`,
            inline: false,
        });
    }

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(embed),
        });
        return true;
    } catch (e) {
        console.error("[Discord] Fail:", e);
        return false;
    }
}

function getSeverityFromScore(score: number): Severity {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
}

function formatVelocityAlerts(alerts: VelocityAlert[]): string {
    if (alerts.length === 0) return "```yaml\nStatus: STABLE\nChange: < threshold\n```";
    const rows = alerts.map(a => `- ${a.protocol} (${a.chain}): +${(a.velocity * 100).toFixed(1)}%`);
    return "```diff\n" + rows.join("\n") + "\n```";
}
