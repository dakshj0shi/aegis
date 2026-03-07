// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./RiskOracle.sol";

/**
 * @title AegisGuard
 * @author AEGIS — Autonomous Economic Guardrail & Intelligence System
 * @notice Active security layer providing circuit breakers for DeFi protocols.
 */
contract AegisGuard is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ENFORCER_ROLE = keccak256("ENFORCER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ── State ────────────────────────────────────────────────────────────────

    RiskOracle public immutable oracle;

    mapping(address => bool) public isPaused;
    address[] public protectedProtocols;
    mapping(address => uint256) public protocolIndex;

    // ── Events ───────────────────────────────────────────────────────────────

    event GuardPaused(address protocol, string reason);
    event GuardUnpaused(address protocol);
    event GlobalShutdownInitiated(uint256 riskScore);
    event GlobalRecoveryInitiated();
    event ProtocolSecured(address indexed protocol);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address _oracle) {
        oracle = RiskOracle(_oracle);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ── Core Enforcements ─────────────────────────────────────────────────────

    /**
     * @notice Returns stability status for a specific node/protocol.
     */
    function isSafe(address _protocol) external view returns (bool) {
        if (paused()) return false; // Global pause
        if (isPaused[_protocol]) return false; // Local protocol pause
        return true;
    }

    /**
     * @notice High-speed enforcement called by Intelligent DON.
     */
    function enforceRiskPolicy(
        uint256 _riskScore,
        RiskOracle.Severity _severity
    ) external onlyRole(ENFORCER_ROLE) nonReentrant {
        if (_severity == RiskOracle.Severity.CRITICAL) {
            if (!paused()) {
                _pause();
                emit GlobalShutdownInitiated(_riskScore);
            }
        } else {
            if (paused()) {
                _unpause();
                emit GlobalRecoveryInitiated();
            }
        }
    }

    /**
     * @notice Targeted circuit breaker for individual pool stress.
     */
    function triggerProtocolPause(address _protocol, string calldata _reason) 
        external 
        onlyRole(ENFORCER_ROLE) 
    {
        isPaused[_protocol] = true;
        emit GuardPaused(_protocol, _reason);
    }

    // ── Admin Functions ──────────────────────────────────────────────────────

    function secureProtocol(address _protocol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isPaused[_protocol] = false;
        protocolIndex[_protocol] = protectedProtocols.length;
        protectedProtocols.push(_protocol);
        emit ProtocolSecured(_protocol);
    }

    function manualUnpause(address _protocol) external onlyRole(GUARDIAN_ROLE) {
        isPaused[_protocol] = false;
        emit GuardUnpaused(_protocol);
    }

    function globalEmergencyStop() external onlyRole(GUARDIAN_ROLE) {
        _pause();
        emit GlobalShutdownInitiated(100);
    }

    function globalEmergencyResume() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
        emit GlobalRecoveryInitiated();
    }
}
