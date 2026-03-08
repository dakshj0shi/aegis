// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IAttestationRegistry {
    function recordAttestation(
        bytes32 _policyHash,
        uint256 _riskScore,
        uint256 _confidence,
        uint256 _checkNumber
    ) external;
}

/**
 * @title RiskOracle
 * @author AEGIS — Autonomous Economic Guardrail & Intelligence System
 * @notice Stores institutional AEGIS risk reports on-chain via Chainlink Intelligence Network.
 */
contract RiskOracle is AccessControl, Pausable {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    enum Severity { LOW, MEDIUM, HIGH, CRITICAL }

    struct RiskReport {
        uint256 riskScore;
        Severity severity;
        uint256 timestamp;
        uint256 confidence; // basis points (9500 = 95%)
        bytes32 policyHash;
        address reporter;
    }

    RiskReport public latestReport;
    RiskReport[] public reportHistory;
    Severity public globalRiskState;
    uint256 public latestCheckNumber;
    bool public anomalyDetected;
    uint256 public lastTotalReservesUSD;
    uint256 public lastTotalClaimedUSD;
    uint256 public lastGlobalRatioBps;
    IAttestationRegistry public attestationRegistry;

    struct ProtocolReport {
        string name;
        string chain;
        uint256 claimed;
        uint256 actual;
        uint256 solvencyRatioBps;
        uint256 utilizationBps;
        uint256 timestamp;
    }

    ProtocolReport[] public latestProtocolReports;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RiskReportSubmitted(
        uint256 indexed reportId,
        uint256 riskScore,
        Severity severity,
        uint256 confidence,
        bytes32 indexed policyHash,
        address reporter
    );

    event OraclePaused(address account);
    event OracleUnpaused(address account);
    event ProtocolReportsUpdated(uint256 count, bool anomalyDetected);
    event AttestationRegistryUpdated(address registry);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Submit a new risk assessment from the DON.
     */
    function submitReport(
        uint256 _riskScore,
        Severity _severity,
        uint256 _confidence,
        bytes32 _policyHash
    ) external onlyRole(REPORTER_ROLE) whenNotPaused {
        require(_riskScore <= 100, "RiskOracle: range overflow");
        
        RiskReport memory report = RiskReport({
            riskScore: _riskScore,
            severity: _severity,
            timestamp: block.timestamp,
            confidence: _confidence,
            policyHash: _policyHash,
            reporter: msg.sender
        });

        latestReport = report;
        reportHistory.push(report);

        emit RiskReportSubmitted(
            reportHistory.length - 1,
            _riskScore,
            _severity,
            _confidence,
            _policyHash,
            msg.sender
        );
    }

    /**
     * @notice Canonical report entrypoint for Chainlink CRE workflows.
     * Payload encoded via encodeAbiParameters in workflow.
     */
    function onReport(
        bytes calldata payload,
        ProtocolReport[] calldata protocols
    ) external onlyRole(REPORTER_ROLE) whenNotPaused {
        (
            uint256 totalReservesUSD,
            uint256 totalClaimedUSD,
            uint256 globalRatioBps,
            uint256 riskScore,
            uint256 timestamp,
            uint256 checkNumber,
            uint8 severityRaw,
            bool anomaly,
            bytes32 policyHash
        ) = abi.decode(payload, (uint256, uint256, uint256, uint256, uint256, uint256, uint8, bool, bytes32));

        Severity severity = Severity(severityRaw);
        uint256 confidence = 9500;

        latestReport = RiskReport({
            riskScore: riskScore,
            severity: severity,
            timestamp: timestamp > 0 ? timestamp : block.timestamp,
            confidence: confidence,
            policyHash: policyHash,
            reporter: msg.sender
        });

        reportHistory.push(latestReport);

        globalRiskState = severity;
        latestCheckNumber = checkNumber;
        anomalyDetected = anomaly;
        lastTotalReservesUSD = totalReservesUSD;
        lastTotalClaimedUSD = totalClaimedUSD;
        lastGlobalRatioBps = globalRatioBps;

        delete latestProtocolReports;
        for (uint256 i = 0; i < protocols.length; i++) {
            latestProtocolReports.push(protocols[i]);
        }

        if (address(attestationRegistry) != address(0)) {
            try attestationRegistry.recordAttestation(policyHash, riskScore, confidence, checkNumber) {
            } catch {
                // no-op on attestation failure
            }
        }

        emit RiskReportSubmitted(
            reportHistory.length - 1,
            riskScore,
            severity,
            confidence,
            policyHash,
            msg.sender
        );

        emit ProtocolReportsUpdated(protocols.length, anomaly);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getReportHistory(uint256 limit) external view returns (RiskReport[] memory) {
        uint256 count = reportHistory.length;
        if (limit > count) limit = count;
        
        RiskReport[] memory results = new RiskReport[](limit);
        for (uint256 i = 0; i < limit; i++) {
            results[i] = reportHistory[count - 1 - i];
        }
        return results;
    }

    function getProtocolReports() external view returns (ProtocolReport[] memory) {
        return latestProtocolReports;
    }

    function getLatestReport() external view returns (
        uint256 riskScore,
        Severity severity,
        uint256 timestamp,
        uint256 confidence,
        bytes32 policyHash
    ) {
        return (
            latestReport.riskScore,
            latestReport.severity,
            latestReport.timestamp,
            latestReport.confidence,
            latestReport.policyHash
        );
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit OraclePaused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit OracleUnpaused(msg.sender);
    }

    function setAttestationRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        attestationRegistry = IAttestationRegistry(_registry);
        emit AttestationRegistryUpdated(_registry);
    }
}
