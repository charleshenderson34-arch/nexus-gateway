import { processTransfer } from "./sequencer.js";

export default {
  async fetch(request, env) {
    const d1Record = await env.DB.prepare(
      "SELECT wallet_address, amount_hex, payload, nonce FROM records WHERE status = 'pending' LIMIT 1"
    ).first();

    if (!d1Record) return new Response("No records", { status: 404 });

    const result = await processTransfer(d1Record, env);
    
    if (!result.error) {
      await env.DB.prepare("UPDATE records SET status = 'processed' WHERE nonce = ?")
        .bind(d1Record.nonce).run();
    }

    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }
};
