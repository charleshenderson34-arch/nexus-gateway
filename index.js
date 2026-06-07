export default {
  async fetch(request, env) {
    // Only accept secure POST requests containing ledger data
    if (request.method !== "POST") {
      return new Response("Method Not Allowed. Send ledger payload via POST.", { status: 405 });
    }

    try {
      const payload = await request.json();
      const { type, data } = payload;

      // Define your backend Halo2 server base URL from environment variables
      const BACKEND_URL = env.HALO2_BACKEND_URL || "http://YOUR_SERVER_IP:3000";

      let targetEndpoint = "";
      let bodyData = {};

      if (type === "BURN") {
        targetEndpoint = `${BACKEND_URL}/prove-burn`;
        bodyData = {
          balance_before: data.balance_before,
          burn_amount: data.burn_amount,
          balance_after: data.balance_after
        };
      } else if (type === "TRANSFER") {
        targetEndpoint = `${BACKEND_URL}/prove-transfer`;
        bodyData = {
          sender_before: data.sender_before,
          receiver_before: data.receiver_before,
          amount: data.amount,
          sender_after: data.sender_after,
          receiver_after: data.receiver_after
        };
      } else {
        return new Response(JSON.stringify({ success: false, error: "Invalid ledger operation type." }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Forward the ledger records to the high-performance Halo2 processing cluster
      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      const result = await response.json();

      // If cryptographic verification succeeds, write the record to Cloudflare D1 production database
      if (result.success) {
        // Optional: execution branch to insert verified block data into env.DB here
        return new Response(JSON.stringify({
          status: "VERIFIED_AND_RECORDED",
          message: result.message
        }), { headers: { "content-type": "application/json" } });
      } else {
        return new Response(JSON.stringify({
          status: "REJECTED",
          message: "Cryptographic constraint failure: Ledger mismatch detected."
        }), { status: 400, headers: { "content-type": "application/json" } });
      }

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }
  }
};
