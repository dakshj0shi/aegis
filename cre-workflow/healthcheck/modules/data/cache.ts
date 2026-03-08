// ─── AEGIS Cache Layer ──────────────────────────────────────────────────────
// Provides in-memory fallbacks for degraded data sources.

import { ProtocolAdapterResult } from "../../types";

export interface CachedPrice {
    price: number;
    updatedAt: number;
}

export interface CachedProtocolData {
    protocols: ProtocolAdapterResult[];
    updatedAt: number;
}

const priceCache = new Map<string, CachedPrice>();
let protocolCache: CachedProtocolData | null = null;

export function getCachedPrice(key: string): CachedPrice | null {
    return priceCache.get(key) ?? null;
}

export function setCachedPrice(key: string, price: number): void {
    priceCache.set(key, { price, updatedAt: Date.now() });
}

export function getCachedProtocols(): CachedProtocolData | null {
    return protocolCache;
}

export function setCachedProtocols(protocols: ProtocolAdapterResult[]): void {
    protocolCache = { protocols, updatedAt: Date.now() };
}

export function markDegraded(details: Record<string, unknown> = {}, reason: string): Record<string, unknown> {
    return {
        ...details,
        dataQuality: "degraded",
        degradedReason: reason,
        degradedAt: new Date().toISOString(),
    };
}
