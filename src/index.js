
rt { createWalletClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Manual Base Chain Definition (No viem/chains import)
const baseChain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } }
};

const USDC_ADDRESS = '0x21117071756a9789c45ade0cfb40e7bce62ce9f0';

export default {
  async scheduled(event, env, ctx) {
    const manifest = await env.NEXUS_ASSETS.get("manifest.json", { type: "json" });
    if (manifest.status !== "PENDING") return;

    const account = privateKeyToAccount(env.PRIVATE_KEY);
    // Use the RPC_URL from the manifest if available, otherwise fallback to env
    const rpc = manifest.rpc_url || env.RPC_URL;
    
    const client = createWalletClient({ 
      account, 
      chain: baseChain, 
      transport: http(rpc) 
    });

    try {
      const amount = parseUnits(manifest.transfer.amount, 6);
      const hash = await client.writeContract({
        address: USDC_ADDRESS,
        abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
        functionName: 'transfer',
        args: [manifest.transfer.to, amount]
      });

      manifest.status = "SUCCESS";
      manifest.last_tx = hash;
      await env.NEXUS_ASSETS.put("manifest.json", JSON.stringify(manifest, null, 2));
    } catch (e) {
      manifest.status = "FAILED";
      manifest.error = e.message;
      await env.NEXUS_ASSETS.put("manifest.json", JSON.stringify(manifest, null, 2));
    }
  }
};

