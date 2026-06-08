// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "src/NexusTokenRegistry.sol";
import "src/Assets.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        new NexusTokenRegistry(msg.sender);
        new Assets();
        vm.stopBroadcast();
    }
}
