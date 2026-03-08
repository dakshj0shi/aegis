// ─── Chainlink Price Feeds ──────────────────────────────────────────────────
// Pulls normalized price data from AggregatorV3Interface.

import { Chain, PriceFeedConfig } from "../../types";
import { EVMClient } from "../evm/client";
import { getCachedPrice, setCachedPrice } from "./cache";

const AGGREGATOR_ABI = [
    {
        inputs: [],
        name: "latestRoundData",
        outputs: [
            { name: "roundId", type: "uint80" },
            { name: "answer", type: "int256" },
            { name: "startedAt", type: "uint256" },
            { name: "updatedAt", type: "uint256" },
            { name: "answeredInRound", type: "uint80" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "decimals", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
];

export interface NormalizedPrice {
    symbol: string;
    price: number;
    updatedAt: number;
    source: "live" | "cache";
}

async function readFeed(
    client: EVMClient,
    address: string,
    symbol: string
): Promise<NormalizedPrice> {
    const cacheKey = `${client.chainName}:${symbol}`;
    try {
        const [roundData, decimals] = await Promise.all([
            client.callContract<{
                answer: bigint;
                updatedAt: bigint;
            }>({
                contractAddress: address,
                functionSignature: "latestRoundData()",
                args: [],
                abi: AGGREGATOR_ABI,
            }),
            client.callContract<number>({
                contractAddress: address,
                functionSignature: "decimals()",
                args: [],
                abi: AGGREGATOR_ABI,
            }),
        ]);

        const answer = extractField(roundData, "answer", 1);
        const updatedAt = extractField(roundData, "updatedAt", 3);
        const scale = Number(decimals ?? 8);
        const price = Number(answer) / Math.pow(10, scale);
        const normalizedUpdatedAt = Number(updatedAt) * 1000;
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("Invalid price value");
        }
        setCachedPrice(cacheKey, price);
        return { symbol, price, updatedAt: normalizedUpdatedAt, source: "live" };
    } catch (error) {
        const cached = getCachedPrice(cacheKey);
        if (cached) {
            return { symbol, price: cached.price, updatedAt: cached.updatedAt, source: "cache" };
        }
        return { symbol, price: symbol === "USDC/USD" ? 1 : 3000, updatedAt: Date.now(), source: "cache" };
    }
}

function extractField(source: unknown, key: string, index: number): bigint {
    if (source && typeof source === "object") {
        const withKey = source as Record<string, unknown>;
        if (key in withKey && typeof withKey[key] === "bigint") {
            return withKey[key] as bigint;
        }
        if (Array.isArray(source) && typeof source[index] === "bigint") {
            return source[index] as bigint;
        }
    }
    throw new Error(`Missing ${key} in feed response`);
}

export async function fetchPriceFeeds(
    client: EVMClient,
    feeds: PriceFeedConfig,
    chain: Chain
): Promise<{ ethUsd: NormalizedPrice; usdcUsd: NormalizedPrice }> {
    const ethAddress = feeds.ethUsd[chain] ?? feeds.ethUsd.ethereum;
    const usdcAddress = feeds.usdcUsd[chain] ?? feeds.usdcUsd.ethereum;

    if (!ethAddress || !usdcAddress) {
        return {
            ethUsd: { symbol: "ETH/USD", price: 3000, updatedAt: Date.now(), source: "cache" },
            usdcUsd: { symbol: "USDC/USD", price: 1, updatedAt: Date.now(), source: "cache" },
        };
    }

    const [ethUsd, usdcUsd] = await Promise.all([
        readFeed(client, ethAddress, "ETH/USD"),
        readFeed(client, usdcAddress, "USDC/USD"),
    ]);

    return { ethUsd, usdcUsd };
}
