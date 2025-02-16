// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is Ownable {
    IERC20 public swarmToken;
    mapping(address => uint256) public stakes;
    mapping(address => uint256) public unlockTime;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address _swarmToken) {
        swarmToken = IERC20(_swarmToken);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake 0");
        require(stakes[msg.sender] == 0, "Already staked"); // Prevent multiple stakes
        require(swarmToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        stakes[msg.sender] = amount;
        unlockTime[msg.sender] = block.timestamp + 30 days; // Lock for 30 days

        emit Staked(msg.sender, amount);
    }

    function unstake() external {
        require(block.timestamp >= unlockTime[msg.sender], "Tokens are still locked");
        uint256 amount = stakes[msg.sender];
        require(amount > 0, "No tokens staked");

        stakes[msg.sender] = 0;
        swarmToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }
}
