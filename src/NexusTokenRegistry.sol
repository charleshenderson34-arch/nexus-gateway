// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract NexusTokenRegistry {
    address public issuer;
    address public treasury;
    constructor(address _issuer, address _treasury) {
        issuer = _issuer;
        treasury = _treasury;
    }
}
