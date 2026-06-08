// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract NexusStateVerifier {
    address public verifierContract;
    bytes32 public latestStateRoot;

    constructor(address _verifier) {
        verifierContract = _verifier;
    }

    function updateState(bytes32 _newRoot, bytes calldata _proof, bytes32[] calldata _publicInputs) external {
        require(IVerifier(verifierContract).verify(_proof, _publicInputs), "Invalid ZK proof");
        latestStateRoot = _newRoot;
    }
}
