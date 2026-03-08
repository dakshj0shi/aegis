# 🛡️ AEGIS — Autonomous Economic Guardrail & Intelligence System

> **Multi-chain DeFi risk monitoring and autonomous protection system built with Chainlink CRE.**

AEGIS continuously monitors DeFi protocols across 3 chains, detects systemic risk signals, and automatically triggers protective mechanisms through smart contract circuit breakers. It transforms raw state into institutional intelligence.

---

## Architecture

AEGIS operates as an autonomous loop orchestrated by Chainlink CRE (Chainlink Runtime Environment).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CHAINLINK CRE DON                               │
│                                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │  Chainlink    │  │  Protocol    │  │  AI Risk     │                  │
│   │  Price Feeds  │  │  Adapters    │  │  Engine      │                  │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│          │                 │                  │                          │
│   ┌──────▼─────────────────▼──────────────────▼───────┐                  │
│   │              AEGIS WORKFLOW (60s)                   │                  │
│   │                                                    │                  │
│   │  1. Load Policy     6. Velocity + Contagion        │                  │
│   │  2. Protocol State  7. AI Risk Engine              │                  │
│   │  3. Price Feeds     8. Risk Score Aggregation      │                  │
│   │  4. Utilization     9. Encode Report Payload       │                  │
│   │  5. Cascade         10. → RiskOracle.onReport()    │                  │
│   └──────┬────────────────────────────────┬────────────┘                  │
│          │                                │                              │
└──────────┼────────────────────────────────┼%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%┘
           │                                │
    ┌──────▼───────┐               ┌────────▼────────┐
    │  EVM Chains  │               │  Smart Contracts │
    │              │               │                  │
    │  • Ethereum  │               │  RiskOracle      │
    │  • Arbitrum  │               │  PolicyEngine    │
    │  • Base      │               │  AegisGuard      │
    └──────────────┘               │  Attestation     │
                                   │  DemoLending     │
                                   └──────────────────┘
                                           │
                                   ┌───────▼────────┐
                                   │   Dashboard    │
                                   │   (Next.js)    │
                                   └────────────────┘
```

---

## Key Features

- **Multi-Chain Intelligence** — Real-time monitoring of Aave V3, Compound V3, Uniswap V3, MakerDAO, Lido across 3 networks.
- **Chainlink Data Feeds** — ETH/USD and USDC/USD normalization for risk calculations.
- **AI Risk Assessment** — Weighted multi-vector model with non-linear systemic amplification and confidence scores.
- **Propagation Modeling** — Graph-based cascade simulation predicting how liquidity shocks spread between nodes.
- **Autonomous Enforcement** — Smart contract circuit breakers (AegisGuard) and dynamic policy adjustment (PolicyEngine).
- **Institutional Dashboard** — High-fidelity analytics interface with network topology and risk trajectory visualization.
- **Compliance Audit** — Immutable on-chain attestation registry for every risk assessment cycle.

---

## Repository Structure

```
aegis/
├── cre-workflow/            # Chainlink CRE Logic
│   └── healthcheck/         # Core 10-step loop
├── contracts/               # Solidity Enforcement Layer
│   ├── AegisGuard.sol       # Circuit Breaker + RBAC
│   ├── RiskOracle.sol       # DON-signed data storage
│   ├── PolicyEngine.sol     # Dynamic parameter adjustment
│   └── AttestationRegistry.sol # Immutable audit log
├── ai/                      # Risk Assessment Engine
│   └── risk-engine.js       # Institutional scoring service
├── dashboard/               # Institutional Terminal
│   └── Next.js + Framer     # High-fidelity UI
├── docker-compose.yml       # Orchestration
└── Makefile                 # System management
```

---

## Quick Start (Docker)

The fastest way to see AEGIS in action is via Docker:

```bash
# 1. Setup environment
cp .env.example .env

# 2. Build and Start
make up

# 3. Access Dashboard
# Open http://localhost:3000
```

---

## Manual Setup

### 1. Start the AI Risk Engine

```bash
cd aegis/ai
npm install
npm start
# 🧠 AI Risk Engine v2.0.0 responsive on port 3001
```

### 2. Start the Dashboard

```bash
cd aegis/dashboard
npm install
npm run dev
# Open http://localhost:3000
```

---

## Intelligence Layers

### Liquidity Velocity
Tracks utilization rate changes between 60-second checks. Detects rapid capital flight and utilization spikes.

### Cross-Chain Contagion
Detects simultaneous stress across multiple chain clusters. SEVERE alert triggered when 3+ chains show synchronized stress.

### Cascade Propagation
Graph-based dependency model. Simulates how stress in Lending (Aave) propagates to Scaling Nodes (Base) and then to Liquidity Pools (Uniswap).

### AI Score (Confidence Weighted)
- **Solvency (35%)**
- **Velocity (25%)**
- **Contagion (20%)**
- **Cascade (15%)**
- **Volatility (5%)**

Confidence scores drop during high volatility, flagging assessments for human review while automated breakers handle the peak stress.

---

## Smart Contracts

The smart contract layer provides the **Security Enforcement**.

1. **RiskOracle**: Stores consensus-signed reports from the DON. Supports `onReport` payload ingestion and protocol-level reports.
2. **AegisGuard**: Multi-mode circuit breaker. Can pause specific protocols or initiate a global shutdown.
3. **PolicyEngine**: Dynamically adjusts borrowing caps and collateral requirements based on current risk severity.
4. **AttestationRegistry**: Verifiable audit trail for institutional compliance.

---

## Live On-Chain Attestation Feed

AEGIS features a specialized dashboard panel that hooks directly into the on-chain consensus state. Every assessment cycle produces a verifiable attestation stored in the `RiskOracle` contract.

**Data Flow:**
1. **CRE Workflow** → Executes risk assessment and signs result.
2. **→ RiskOracle** → Stores the DON-signed latest report.
3. **→ AttestationRegistry** → Maintains an immutable history for compliance.
4. **→ Dashboard Feed** → Polls the contract to display real-time institutional proofs.

### Live Data Mode
To enable valid multi-chain data ingestion (non-simulated), configure the following environment variables in your `.env`:
- `RPC_ETHEREUM`: Mainnet ETH RPC provider.
- `RPC_ARBITRUM`: Arbitrum RPC provider.
- `RPC_BASE`: Base RPC provider.
- `NEXT_PUBLIC_RPC_URL`: RPC used by the dashboard poller.
- `NEXT_PUBLIC_RISK_ORACLE_ADDRESS`: The deployed address of the Aegis RiskOracle.
- `NEXT_PUBLIC_AEGIS_GUARD_ADDRESS`: The deployed address of the AegisGuard.

### Chainlink Price Feeds
Configured in `cre-workflow/healthcheck/config/config.staging.json`:
- `priceFeeds.ethUsd`
- `priceFeeds.usdcUsd`

If these variables are missing, the system automatically defaults to **High-Fidelity Simulation Mode** to ensure dashboard availability and demo stability.

---

MIT — Built for Chainlink Intelligence Network 2025
Property of Advanced Institutional Risk Lab
# 3. Run the CRE Workflow (Local)

```bash
cd aegis/cre-workflow/healthcheck
npm install
npm run start
```
