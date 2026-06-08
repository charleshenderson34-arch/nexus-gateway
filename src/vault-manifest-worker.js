export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint to broadcast the hex you generated and signed
    if (url.pathname === "/api/vault/broadcast" && request.method === "POST") {
      const { tx_hex } = await request.json();
      
      // Using a high-availability Bitcoin relay
      const response = await fetch("https://blockstream.info/api/tx", {
        method: "POST",
        body: tx_hex
      });

      const txid = await response.text();
      return new Response(JSON.stringify({ success: response.ok, txid: txid }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Vault Service Online", { status: 200 });
  }
};
