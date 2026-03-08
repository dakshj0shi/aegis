// ─── AEGIS REAL EVM CLIENT ───────────────────────────────────────────────
// Sends real transactions using ethers.js

import { ethers } from "ethers"
import dotenv from "dotenv"
import { ChainConfig, Chain } from "../../types"

dotenv.config()

if (!process.env.SEPOLIA_RPC) {
    throw new Error("SEPOLIA_RPC is required")
}
if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is required")
}

const writeProvider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC,
    undefined,
    { staticNetwork: true }
)

const wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY!,
    writeProvider
)

export class EVMClient {
    private config: ChainConfig
    private connected: boolean = false
    private readProvider: ethers.JsonRpcProvider

    constructor(config: ChainConfig) {
        this.config = config
        this.readProvider = new ethers.JsonRpcProvider(
            this.config.rpcUrl,
            undefined,
            { staticNetwork: true }
        )
    }

    get chainName(): Chain {
        return this.config.name
    }

    get chainId(): number {
        return this.config.chainId
    }

    async connect(): Promise<void> {
        console.log(
            `[EVMClient] Connected to ${this.config.name} (chainId ${this.config.chainId})`
        )
        this.connected = true
    }

    async readContract(params: {
        contractAddress: string
        functionSignature: string
        args: unknown[]
        abi: any[]
    }): Promise<any> {

        if (!this.connected) await this.connect()

        const contract = new ethers.Contract(
            params.contractAddress,
            params.abi,
            this.readProvider
        )

        const functionName = params.functionSignature.split("(")[0]

        const result = await contract[functionName](...params.args)

        console.log(
            `[EVMClient:${this.config.name}] Read ${functionName} from ${params.contractAddress}`
        )

        return result
    }

    async callContract<T>(params: {
        contractAddress: string
        functionSignature: string
        args: unknown[]
        abi: any[]
    }): Promise<T> {

        const result = await this.readContract(params)

        return result as T
    }

    async writeContract(params: {
        contractAddress: string
        functionSignature: string
        args: unknown[]
        abi: any[]
        value?: bigint
    }): Promise<string> {

        if (!this.connected) await this.connect()

        const contract = new ethers.Contract(
            params.contractAddress,
            params.abi,
            wallet
        )

        const functionName = params.functionSignature.split("(")[0]

        console.log(
            `[EVMClient:${this.config.name}] Sending TX ${functionName}`
        )

        const tx = await contract[functionName](...params.args, {
            value: params.value ?? 0
        })

        console.log(
            `[EVMClient:${this.config.name}] TX SENT → ${tx.hash}`
        )

        await tx.wait()

        console.log(
            `[EVMClient:${this.config.name}] TX CONFIRMED`
        )

        return tx.hash
    }

    async getEthPrice(priceFeedAddress: string): Promise<number> {

        const abi = [
            {
                inputs: [],
                name: "latestRoundData",
                outputs: [
                    { name: "roundId", type: "uint80" },
                    { name: "answer", type: "int256" },
                    { name: "startedAt", type: "uint256" },
                    { name: "updatedAt", type: "uint256" },
                    { name: "answeredInRound", type: "uint80" }
                ],
                stateMutability: "view",
                type: "function"
            }
        ]

        const result = await this.callContract<any>({
            contractAddress: priceFeedAddress,
            functionSignature: "latestRoundData()",
            args: [],
            abi
        })

        if (!result) return 3000

        const answer = result[1]

        return Number(answer) / 1e8
    }

    async writeReport(params: {
        contractAddress: string
        payload: `0x${string}`
        protocolReports: {
            name: string
            chain: string
            claimed: bigint
            actual: bigint
            solvencyRatioBps: bigint
            utilizationBps: bigint
            timestamp: bigint
        }[]
    }): Promise<string> {

        const abi = [
            {
                inputs: [
                    { name: "payload", type: "bytes" },
                    {
                        name: "protocols",
                        type: "tuple[]",
                        components: [
                            { name: "name", type: "string" },
                            { name: "chain", type: "string" },
                            { name: "claimed", type: "uint256" },
                            { name: "actual", type: "uint256" },
                            { name: "solvencyRatioBps", type: "uint256" },
                            { name: "utilizationBps", type: "uint256" },
                            { name: "timestamp", type: "uint256" }
                        ]
                    }
                ],
                name: "onReport",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ]

        return this.writeContract({
            contractAddress: params.contractAddress,
            functionSignature:
                "onReport(bytes,(string,string,uint256,uint256,uint256,uint256,uint256)[])",
            args: [params.payload, params.protocolReports],
            abi
        })
    }
}

export function createClients(
    chains: ChainConfig[]
): Map<Chain, EVMClient> {

    const clients = new Map<Chain, EVMClient>()

    for (const chain of chains) {
        clients.set(chain.name, new EVMClient(chain))
    }

    return clients
}
