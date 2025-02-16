// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FeeManager is Ownable {
    uint256 public baseFee = 100; // 0.1% fee
    IERC20 public usdcToken;
    address public treasury;
    address public governance;
    mapping(address => uint256) public userStakes;

    event FeePaid(address indexed user, uint256 fee, string currency);
    event FeeUpdated(uint256 newFee);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Only governance can update fees");
        _;
    }

    constructor(address _usdcToken, address _treasury, address _governance) {
        usdcToken = IERC20(_usdcToken);
        treasury = _treasury;
        governance = _governance;
    }

    function payFeeETH(uint256 txAmount) external payable {
        uint256 fee = calculateFee(txAmount);
        require(msg.value >= fee, "Insufficient ETH for fee");
        payable(treasury).transfer(fee);
        emit FeePaid(msg.sender, fee, "ETH");
    }

    function payFeeUSDC(uint256 txAmount) external {
        uint256 fee = calculateFee(txAmount);
        require(usdcToken.transferFrom(msg.sender, treasury, fee), "USDC payment failed");
        emit FeePaid(msg.sender, fee, "USDC");
    }

    function calculateFee(uint256 amount) public view returns (uint256) {
        return (amount * baseFee) / 100000; // 0.1%
    }

    function updateFee(uint256 newFee) external onlyGovernance {
        require(newFee <= 1000, "Fee too high");
        baseFee = newFee;
        emit FeeUpdated(newFee);
    }
}
