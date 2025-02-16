// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Governance is Ownable {
    mapping(address => uint256) public votes;
    uint256 public quorum;
    uint256 public proposalCount;

    struct Proposal {
        string description;
        uint256 votes;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;

    event ProposalSubmitted(uint256 proposalId, string description);
    event ProposalPassed(uint256 proposalId, string description);

    constructor(uint256 _quorum) {
        quorum = _quorum;
    }

    function submitProposal(string calldata description) external {
        proposals[proposalCount] = Proposal(description, 0, false);
        emit ProposalSubmitted(proposalCount, description);
        proposalCount++;
    }

    function voteOnProposal(uint256 proposalId) external {
        require(votes[msg.sender] > 0, "No votes assigned");
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");

        proposal.votes += votes[msg.sender];

        if (proposal.votes >= quorum) {
            proposal.executed = true;
            emit ProposalPassed(proposalId, proposal.description);
        }
    }

    function updateQuorum(uint256 newQuorum) external onlyOwner {
        quorum = newQuorum;
    }
}
