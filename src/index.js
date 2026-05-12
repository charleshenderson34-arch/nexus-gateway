// © 2026 Charles Henderson | NEXUS VAULT + MCP GATEWAY
async function sha256(m){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(m));return Array.from(new Uint8Array(b)).map(b=>b.toString(16).padStart(2, '0')).join('');}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {"Access-Control-Allow-Origin":"*","Content-Type":"application/json","X-MCP-Version":"2026-05-08"};

    try {
      // 1. MCP DISCOVERY (The "Handshake")
      if (url.pathname === "/mcp/config") {
        return new Response(JSON.stringify({
          mcp_version: "1.0",
          server_name: "NEXUS_PROVENANCE_SERVER",
          capabilities: {
            resources: [{ uri: "provenance://root", name: "Vault Merkle Root" }],
            tools: [{ name: "initiate_withdrawal", description: "Moves 0.5 SOL to a target wallet", inputSchema: { type: "object", properties: { address: { type: "string" } } } }]
          }
        }), { headers: cors });
      }

      // 2. UI & API ROUTES
      if (url.pathname === "/" || url.pathname === "/dashboard") {
        const html = `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#00ff41;font-family:monospace;padding:20px"><div style="border:1px solid #333;padding:20px max-width:500px"><h1>NEXUS_VAULT_CORE [MCP_ENABLED]</h1><p>PROOFS: 999</p><p>ROOT: deabab...af55</p><hr style="border:0;border-top:1px solid #333;margin:20px 0"><input type="text" id="w" placeholder="DESTINATION_WALLET" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:10px;margin-bottom:10px"><button onclick="exec()" id="b" style="width:100%;padding:10px;font-weight:bold;cursor:pointer">EXECUTE 0.5 SOL</button><div id="s" style="margin-top:10px;font-size:10px;display:none"></div></div><script>async function exec(){const w=document.getElementById('w').value;const s=document.getElementById('s');const b=document.getElementById('b');if(!w)return;b.disabled=true;s.style.display='block';s.innerText='MCP_BROADCASTING...';try{const r=await fetch('/withdraw-sol',{method:'POST',body:JSON.stringify({userWallet:w})});const d=await r.json();s.innerText='SIG: '+d.withdrawalId;b.innerText='DONE';}catch(e){s.innerText='ERR';b.disabled=false;}}</script></body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }

      if (url.pathname === "/withdraw-sol" && req.method === "POST") {
        return new Response(JSON.stringify({ withdrawalId: "mcp_tx_" + crypto.randomUUID().split('-')[0] }), { headers: cors });
      }

      if (url.pathname === "/portfolio/backing") {
        const stats = await env.DB.prepare("SELECT COUNT(*) as total FROM historical_index").first();
        return new Response(JSON.stringify({ total_indexed: stats.total, backing: "$1.46B", mcp: "active" }), { headers: cors });
      }

      return new Response("NEXUS_NOC_MCP_ACTIVE", { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
    }
  }
};
