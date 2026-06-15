// © 2026 Charles Henderson. All rights reserved.
import { ethers } from "ethers";

export async function processTransfer(record, env) {
  // Build the transfer object
  const tx = {
    to: record.wallet_address,
    value: record.amount_hex,
    data: record.payload,
    chainId: 1,
    gasPrice: 0,
    gasLimit: 21000,
    nonce: Number(record.nonce)
  };

  const wallet = new ethers.Wallet(env.PRIVATE_KEY);
  const signedTx = await wallet.signTransaction(tx);

  // Direct injection to your RPC
  const response = await fetch(env.RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendRawTransaction",
      params: [signedTx],
      id: 1
    })
  });

  return await response.json();
}
