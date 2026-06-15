// © 2026 Charles Henderson. All rights reserved.
import { ethers } from "ethers";

export default {
  async fetch(request, env) {
    try {
      let targetAddress = "";
      let txValue = "0x0";
      let txData = "0x";
      let txNonce = 0;

      // 1. EXTRACT DATA: Pull pending asset records from nexus-mainnet-vault
      const d1Record = await env.DB.prepare(
        "SELECT wallet_address, amount_hex, payload, nonce FROM records WHERE status = 'pending' LIMIT 1"
      ).first();

      if (d1Record) {
        targetAddress = d1Record.wallet_address;
        txValue = d1Record.amount_hex;
        txData = d1Record.payload;
        txNonce = d1Record.nonce;
      } else {
        // Fallback: Pull from nexus-assets R2 bucket
        const r2Object = await env.BUCKET.get("latest_record.json");
        if (r2Object) {
          const r2Record = await r2Object.json();
          targetAddress = r2Record.wallet_address;
          txValue = r2Record.amount_hex;
          txData = r2Record.payload;
          txNonce = r2Record.nonce;
        }
      }

      if (!targetAddress) {
        return new Response(JSON.stringify({ message: "No pending records to transfer" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // 2. INITIALIZE AUTHORITY: The private key acts as the cryptographic signer
      const wallet = new ethers.Wallet(env.PRIVATE_KEY);

      // 3. BUILD TRANSFER LOGIC: Structure the data for network execution
      // This maps your database variables strictly into the EVM transfer architecture
      const tx = {
        to: targetAddress,        // The destination wallet receiving the transfer
        value: txValue,           // The asset amount to transfer (must be in Hex/Wei)
        data: txData,             // Optional payload data
        chainId: 1,               // Network ID
        gasPrice: 0,              // Zero-gas instruction for your personal RPC
        gasLimit: 21000,          // Standard computational limit for a native transfer
        nonce: Number(txNonce)    // Sequential transaction ordering
      };

      // 4. THE CRYPTO TRANSFORMATION:
      // This single line takes the text structure above and applies the ECDSA signature.
      // It transforms your database record into an RLP-encoded, cryptographically secure hex payload.
      // This is the exact moment the data becomes "crypto".
      const signedTx = await wallet.signTransaction(tx);

      // 5. EXECUTE TRANSFER: 
      // Push the cryptographically signed hex directly to your personal bluelighttechcompany RPC.
      // Once the RPC receives this, it updates the blockchain ledger, transferring the value to your wallet.
      const rpcResponse = await fetch(env.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendRawTransaction",
          params: [signedTx],
          id: 1
        })
      });

      const rpcResult = await rpcResponse.json();

      // 6. RECORD SETTLEMENT: Update nexus-mainnet-vault to prevent double-spending
      if (d1Record && !rpcResult.error) {
        await env.DB.prepare(
          "UPDATE records SET status = 'processed' WHERE nonce = ?"
        ).bind(txNonce).run();
      }

      return new Response(JSON.stringify(rpcResult), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
