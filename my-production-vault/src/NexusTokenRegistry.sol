// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Charles Timothy Henderson. All rights reserved.
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NexusTokenRegistry is ERC20, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(address => bool) public isAssetSupported;
    address[] public registeredAssets;

    event AssetRegistered(address indexed assetAddress, string symbol);
    event TreasuryAllocationMinted(address indexed treasury, uint256 amount);

    constructor(address rootAdmin, address treasuryAllocation) 
        ERC20("Nexus Settlement Asset", "NXSA") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, rootAdmin);
        _grantRole(ADMIN_ROLE, rootAdmin);
        _grantRole(ISSUER_ROLE, rootAdmin);
        _grantRole(MINTER_ROLE, rootAdmin);

        uint256 initialSupply = 100000000 * 10**decimals();
        _mint(treasuryAllocation, initialSupply);
        emit TreasuryAllocationMinted(treasuryAllocation, initialSupply);
    }

    function registerTokenAsset(address assetAddress, string calldata symbol) 
        external 
        onlyRole(ISSUER_ROLE) 
    {
        require(assetAddress != address(0), "Invalid asset address");
        require(!isAssetSupported[assetAddress], "Asset already registered");
        
        isAssetSupported[assetAddress] = true;
        registeredAssets.push(assetAddress);
        
        emit AssetRegistered(assetAddress, symbol);
    }
}
