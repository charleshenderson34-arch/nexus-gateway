import { SolanaProcessor, SolanaNetwork } from "@sentio/sdk/solana";
import { api, base64 } from "@sentio/sdk";

// ============================================================
// CONFIGURATION - UPDATE WITH YOUR VALUES
// ============================================================
const PROGRAM_ID = "YOUR_PROGRAM_ID_HERE"; // e.g., 7gYJe2Yp...
const EVENT_NAME = "YourMerkleEvent"; // e.g., RecordBroadcast, MerkleVerified
const MERKLE_ROOT = "YOUR_MERKLE_ROOT_HERE"; // From NEXUS_MERKLE_STORE KV
const OWNER_EMAIL = "tim@charleshendersonandhendfam.online";
const START_BLOCK = 275000000; // July 21, 2024 on Solana Devnet

// Cloudflare D1 Database
const D1_DATABASE_ID = "3ab9be54-abb6-4b15-99b6-a32fc7b4c388"; // nexus-provenance

// ============================================================
// SENTIO PROCESSOR BINDING
// ============================================================
SolanaProcessor.bind({
  address: PROGRAM_ID,
  network: SolanaNetwork.SOLANA_DEVNET,
  startBlock: START_BLOCK,
})
  .onEvent(EVENT_NAME, async (event, ctx) => {
    try {
      // Parse event data
      const { 
        recordId, 
        merkleProof, 
        leafHash, 
        etoroData, 
        timestamp 
      } = parseEventData(event);

      // Verify Merkle proof against known root
      const proofValid = verifyMerkleProof(
        leafHash,
        merkleProof,
        MERKLE_ROOT
      );

      if (!proofValid) {
        ctx.eventLogger.error(
          `Invalid Merkle proof for record ${recordId}`,
          { leafHash, merkleRoot: MERKLE_ROOT }
        );
        await logSentioSync("merkle_verification_failed", "failed", {
          recordId,
          reason: "Invalid Merkle proof",
        });
        return;
      }

      // Broadcast to D1
      const broadcastResult = await broadcastToD1({
        recordId,
        merkleProof,
        leafHash,
        etoroData,
        timestamp,
        owner: OWNER_EMAIL,
        merkleRoot: MERKLE_ROOT,
      });

      if (!broadcastResult.success) {
        ctx.eventLogger.error(
          `Failed to broadcast record ${recordId} to D1`,
          broadcastResult.error
        );
        await logSentioSync("d1_broadcast_failed", "failed", {
          recordId,
          error: broadcastResult.error,
        });
        return;
      }

      // Log successful sync
      await logSentioSync("record_broadcast", "success", {
        recordId,
        leafHash,
        etoroData: etoroData.type,
      });

      // Update global state with last synced timestamp
      await updateGlobalState(timestamp);

      ctx.eventLogger.info(
        `Record ${recordId} successfully broadcast and synced`,
        { merkleProof: leafHash }
      );
    } catch (error) {
      ctx.eventLogger.error(
        `Error processing event: ${error}`,
        { event }
      );
      await logSentioSync("processing_error", "failed", {
        error: String(error),
        event: JSON.stringify(event),
      });
    }
  });

// ============================================================
// HELPER: Parse event data from Solana program
// ============================================================
function parseEventData(event: any) {
  // Adapt this based on your Solana program's event structure
  const data = event.data;

  return {
    recordId: data.recordId || "",
    merkleProof: data.merkleProof || [], // Array of hashes
    leafHash: data.leafHash || "", // Hash of record leaf
    etoroData: {
      type: data.transactionType || "transfer", // e.g., buy, sell, transfer
      asset: data.asset || "",
      amount: data.amount || 0,
      price: data.price || 0,
      pnl: data.pnl || 0,
      units: data.units || 0,
      date: data.transactionDate || new Date().toISOString(),
      notes: data.notes || "",
      address: data.walletAddress || "",
    },
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

// ============================================================
// HELPER: Verify Merkle proof
// ============================================================
function verifyMerkleProof(
  leaf: string,
  proof: string[],
  root: string
): boolean {
  let current = leaf;

  for (const proofElement of proof) {
    // Simple hash concatenation (adapt based on your Merkle tree implementation)
    current = keccak256(current + proofElement);
  }

  return current === root;
}

// Placeholder: Use your actual hashing library
function keccak256(data: string): string {
  // In production, use ethers.js or crypto-js
  // import { ethers } from 'ethers';
  // return ethers.keccak256(ethers.toUtf8Bytes(data));
  
  // For now, return a simple hash simulation
  return `0x${Buffer.from(data).toString("hex").substring(0, 64)}`;
}

// ============================================================
// HELPER: Broadcast record to Cloudflare D1
// ============================================================
async function broadcastToD1(record: {
  recordId: string;
  merkleProof: string[];
  leafHash: string;
  etoroData: any;
  timestamp: string;
  owner: string;
  merkleRoot: string;
}) {
  try {
    // Insert into etoro_records table
    const insertResult = await api.post(
      `/databases/${D1_DATABASE_ID}/query`,
      {
        sql: `
          INSERT INTO etoro_records (
            id, record_id, date, type, asset, amount, price, pnl, units, 
            notes, address, source, merkle_root, leaf_hash, synced_to_sentio, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          `${record.recordId}-${Date.now()}`, // Unique ID
          record.recordId,
          record.etoroData.date,
          record.etoroData.type,
          record.etoroData.asset,
          record.etoroData.amount,
          record.etoroData.price,
          record.etoroData.pnl,
          record.etoroData.units,
          record.etoroData.notes,
          record.etoroData.address,
          "etoro",
          record.merkleRoot,
          record.leafHash,
          1, // synced_to_sentio = true
          new Date().toISOString(),
        ],
      }
    );

    // Create merkle claim entry
    await api.post(`/databases/${D1_DATABASE_ID}/query`, {
      sql: `
        INSERT INTO merkle_claims (
          id, claim_id, claimant, amount, record_id, leaf_hash, merkle_root, 
          status, proof_valid, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        `claim-${record.recordId}-${Date.now()}`,
        record.recordId,
        record.owner,
        record.etoroData.amount?.toString() || "0",
        record.recordId,
        record.leafHash,
        record.merkleRoot,
        "verified",
        1, // proof_valid = true
        new Date().toISOString(),
      ],
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

// ============================================================
// HELPER: Log sync event to sentio_sync_log
// ============================================================
async function logSentioSync(
  eventName: string,
  status: "success" | "failed",
  payload: any
) {
  try {
    await api.post(`/databases/${D1_DATABASE_ID}/query`, {
      sql: `
        INSERT INTO sentio_sync_log (event_name, status, payload, synced_at)
        VALUES (?, ?, ?, ?)
      `,
      params: [
        eventName,
        status,
        JSON.stringify(payload),
        new Date().toISOString(),
      ],
    });
  } catch (error) {
    console.error(`Failed to log sync event: ${error}`);
  }
}

// ============================================================
// HELPER: Update global state with last synced timestamp
// ============================================================
async function updateGlobalState(timestamp: string) {
  try {
    await api.post(`/databases/${D1_DATABASE_ID}/query`, {
      sql: `
        INSERT OR REPLACE INTO global_state (key, value)
        VALUES (?, ?)
      `,
      params: ["last_synced_timestamp", timestamp],
    });
  } catch (error) {
    console.error(`Failed to update global state: ${error}`);
  }
}

// ============================================================
// EXPORT for Sentio deployment
// ============================================================
export default {};
