// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract NexusTokenRegistry {
    address public issuerAuthority;
    constructor(address _issuer) { issuerAuthority = _issuer; }
}
