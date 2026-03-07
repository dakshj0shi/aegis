// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RiskOracle.sol";

/**
 * @title PolicyEngine
 * @author AEGIS — Autonomous Economic Guardrail & Intelligence System
 * @notice Intelligent policy layer that translates risk scores into actionable protocol parameters.
 */
contract PolicyEngine is AccessControl {
    bytes32 public constant ARCHITECT_ROLE = keccak256("ARCHITECT_ROLE");

    struct Policy {
        uint256 borrowCap;
        uint256 liquidationThreshold; // basis points
        uint256 interestRateMultiplier; // basis points
        uint256 collateralRequirement; // basis points
    }

    RiskOracle public immutable oracle;
    Policy public currentPolicy;
    Policy public baselinePolicy;

    event PolicyUpdated(uint256 riskScore, string severity);
    event PolicyOverridden(address architect);

    constructor(address _oracle) {
        oracle = RiskOracle(_oracle);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        baselinePolicy = Policy({
            borrowCap: 1_000_000,
            liquidationThreshold: 8000,
            interestRateMultiplier: 10000,
            collateralRequirement: 15000
        });
        currentPolicy = baselinePolicy;
    }

    /**
     * @notice Recalculates policy based on most recent risk assessment.
     */
    function synchronisePolicy() external returns (Policy memory) {
        (uint256 score, RiskOracle.Severity severity, , , ) = oracle.getLatestReport();

        if (severity == RiskOracle.Severity.CRITICAL) {
            currentPolicy = Policy(0, 9500, 50000, 30000);
        } else if (severity == RiskOracle.Severity.HIGH) {
            currentPolicy = Policy(baselinePolicy.borrowCap / 4, 8500, 20000, 20000);
        } else if (severity == RiskOracle.Severity.MEDIUM) {
            currentPolicy = Policy(baselinePolicy.borrowCap / 2, 8200, 15000, 17500);
        } else {
            currentPolicy = baselinePolicy;
        }

        emit PolicyUpdated(score, _severityToString(severity));
        return currentPolicy;
    }

    function updateBaseline(Policy calldata _newBaseline) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baselinePolicy = _newBaseline;
    }

    function _severityToString(RiskOracle.Severity _sev) internal pure returns (string memory) {
        if (_sev == RiskOracle.Severity.LOW) return "LOW";
        if (_sev == RiskOracle.Severity.MEDIUM) return "MEDIUM";
        if (_sev == RiskOracle.Severity.HIGH) return "HIGH";
        return "CRITICAL";
    }
}
