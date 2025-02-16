// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @dev Manages protocol funds with DAO-controlled withdrawals.
 */
contract Treasury is Ownable, ReentrancyGuard {
    address public governance;
    address public feeManager;

    struct WithdrawalProposal {
        address recipient;
        uint256 amount;
        bool executed;
    }

    mapping(uint256 => WithdrawalProposal) public proposals;
    uint256 public proposalCount;

    event FundsReceived(address indexed sender, uint256 amount, string currency);
    event FundsWithdrawn(address indexed recipient, uint256 amount, string currency);
    event ProposalCreated(uint256 indexed proposalId, address indexed recipient, uint256 amount);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Only governance can execute");
        _;
    }

    constructor(address _governance, address _feeManager) {
        require(_governance != address(0), "Invalid governance address");
        require(_feeManager != address(0), "Invalid FeeManager address");

        governance = _governance;
        feeManager = _feeManager;
    }

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value, "ETH");
    }

    function depositERC20(address token, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit FundsReceived(msg.sender, amount, "ERC20");
    }

    function createWithdrawalProposal(address recipient, uint256 amount) external onlyGovernance {
        proposals[proposalCount] = WithdrawalProposal(recipient, amount, false);
        emit ProposalCreated(proposalCount, recipient, amount);
        proposalCount++;
    }

    function executeWithdrawal(uint256 proposalId) external onlyGovernance nonReentrant {
        WithdrawalProposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(address(this).balance >= proposal.amount, "Insufficient balance");

        proposal.executed = true;
        payable(proposal.recipient).transfer(proposal.amount);

        emit ProposalExecuted(proposalId, proposal.recipient, proposal.amount);
    }
}

