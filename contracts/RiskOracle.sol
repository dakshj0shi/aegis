// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

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
}
