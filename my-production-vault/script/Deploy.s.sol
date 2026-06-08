// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "src/NexusTokenRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        // Deploying registry
        new NexusTokenRegistry(0x2f4eBBD12848F7C3De8C6ED679734E3238f219EE, 0x2f4eBBD12848F7C3De8C6ED679734E3238f219EE);
        
        vm.stopBroadcast();
    }
}
