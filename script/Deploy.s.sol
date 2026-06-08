// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "src/NexusTokenRegistry.sol";
import "src/Assets.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address targetAddress = 0x2f4eBBD12848F7C3De8C6ED679734E3238f219EE;
        
        vm.startBroadcast(deployerKey);
        
        // Using your specified address for both arguments
        new NexusTokenRegistry(targetAddress, targetAddress);
        new Assets();
        
        vm.stopBroadcast();
    }
}
