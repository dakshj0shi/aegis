// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AttestationRegistry
 * @author AEGIS — Autonomous Economic Guardrail & Intelligence System
 * @notice Verifiable institutional audit log for risk policy compliance.
 */
contract AttestationRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    struct Attestation {
        bytes32 policyHash;
        uint256 riskScore;
        uint256 confidence;
        uint256 timestamp;
        uint256 checkNumber;
        address attester;
    }

    Attestation[] public archive;
    mapping(bytes32 => uint256[]) public policyIndex;

    event AttestationRecorded(
        uint256 indexed index,
        bytes32 indexed policyHash,
        uint256 riskScore,
        address attester
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function recordAttestation(
        bytes32 _policyHash,
        uint256 _riskScore,
        uint256 _confidence,
        uint256 _checkNumber
    ) external onlyRole(ATTESTER_ROLE) {
        require(_riskScore <= 100, "Attestation: risk overflow");

        archive.push(Attestation({
            policyHash: _policyHash,
            riskScore: _riskScore,
            confidence: _confidence,
            timestamp: block.timestamp,
            checkNumber: _checkNumber,
            attester: msg.sender
        }));

        policyIndex[_policyHash].push(archive.length - 1);

        emit AttestationRecorded(
            archive.length - 1,
            _policyHash,
            _riskScore,
            msg.sender
        );
    }

    function getHistory(uint256 limit) external view returns (Attestation[] memory) {
        uint256 count = archive.length;
        if (limit > count) limit = count;
        
        Attestation[] memory page = new Attestation[](limit);
        for (uint256 i = 0; i < limit; i++) {
            page[i] = archive[count - 1 - i];
        }
        return page;
    }
}
