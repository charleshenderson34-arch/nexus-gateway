// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract PortfolioVault {
    address public owner;
    constructor() { owner = msg.sender; }
    function approveSpending(address token, address spender, uint256 amount) public {
        require(msg.sender == owner, "Only owner");
        IERC20(token).approve(spender, amount);
    }
    receive() external payable {}
}
