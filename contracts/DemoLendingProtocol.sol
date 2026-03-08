// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AegisGuard.sol";

/**
 * @title DemoLendingProtocol
 * @notice Secured lending protocol integrated with AEGIS Guard.
 */
contract DemoLendingProtocol is ReentrancyGuard {
    AegisGuard public immutable guard;
    
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public borrows;
    uint256 public totalLiquidity;

    event LiquidFundsMovement(address user, uint256 amount, string action);

    constructor(address _guard) {
        guard = AegisGuard(_guard);
    }

    /**
     * @notice Checked for safety by AEGIS circuit breaker.
     */
    modifier isHealthy() {
        require(guard.isSafe(address(this)), "AEGIS: node circuit breaker engaged");
        _;
    }

    function deposit() external payable nonReentrant {
        deposits[msg.sender] += msg.value;
        totalLiquidity += msg.value;
        emit LiquidFundsMovement(msg.sender, msg.value, "DEPOSIT");
    }

    function borrow(uint256 amount) external isHealthy nonReentrant {
        require(amount <= address(this).balance, "Insufficient liquidity");
        require(deposits[msg.sender] * 75 / 100 >= borrows[msg.sender] + amount, "Insufficient collateral");
        
        borrows[msg.sender] += amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        emit LiquidFundsMovement(msg.sender, amount, "BORROW");
    }

    function repay() external payable nonReentrant {
        require(borrows[msg.sender] >= msg.value, "Repayment overflow");
        borrows[msg.sender] -= msg.value;
        emit LiquidFundsMovement(msg.sender, msg.value, "REPAY");
    }
}
