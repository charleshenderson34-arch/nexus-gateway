-- ============================================================
-- Cloudflare D1 Schema for Sentio Processor
-- Database: nexus-provenance
-- ============================================================

-- ============================================================
-- TABLE: global_state
-- Purpose: Track processor state (last sync timestamp, config)
-- ============================================================
CREATE TABLE IF NOT EXISTS global_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Initialize global state with sync start date
INSERT OR IGNORE INTO global_state (key, value)
VALUES ('last_synced_timestamp', '2024-07-21T00:00:00Z');

INSERT OR IGNORE INTO global_state (key, value)
VALUES ('processor_status', 'active');

INSERT OR IGNORE INTO global_state (key, value)
VALUES ('owner_email', 'tim@charleshendersonandhendfam.online');

-- ============================================================
-- TABLE: merkle_roots
-- Purpose: Store active Merkle root hashes for verification
-- ============================================================
CREATE TABLE IF NOT EXISTS merkle_roots (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  leaf_count INTEGER,
  record_count INTEGER,
  source TEXT,
  wallet TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert the active Merkle root (UPDATE THIS WITH YOUR ACTUAL ROOT)
INSERT OR IGNORE INTO merkle_roots (
  id, root, leaf_count, record_count, source, wallet
) VALUES (
  'root-etoro-primary',
  'YOUR_MERKLE_ROOT_HERE', -- REPLACE WITH YOUR ACTUAL ROOT
  0,
  0,
  'etoro',
  'tim@charleshendersonandhendfam.online'
);

-- ============================================================
-- TABLE: etoro_records
-- Purpose: Permanent record of all migrated Etoro transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS etoro_records (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  date TEXT,
  type TEXT,
  asset TEXT,
  amount REAL,
  price REAL,
  pnl REAL,
  units REAL,
  notes TEXT,
  address TEXT,
  source TEXT DEFAULT 'etoro',
  merkle_root TEXT,
  leaf_hash TEXT NOT NULL,
  synced_to_sentio INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(record_id, leaf_hash)
);

-- Create index for Merkle root lookups
CREATE INDEX IF NOT EXISTS idx_etoro_merkle_root 
  ON etoro_records(merkle_root);

-- Create index for Sentio sync tracking
CREATE INDEX IF NOT EXISTS idx_etoro_synced 
  ON etoro_records(synced_to_sentio);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_etoro_date 
  ON etoro_records(date DESC);

-- ============================================================
-- TABLE: merkle_claims
-- Purpose: Track merkle proof claims and their verification status
-- ============================================================
CREATE TABLE IF NOT EXISTS merkle_claims (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  claimant TEXT NOT NULL,
  amount TEXT,
  record_id TEXT,
  leaf_hash TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  status TEXT DEFAULT 'queued', -- queued, verified, rejected
  proof_valid INTEGER DEFAULT 0,
  submitted_at TEXT DEFAULT (datetime('now')),
  verified_at TEXT,
  FOREIGN KEY (record_id) REFERENCES etoro_records(record_id)
);

-- Create index for claimant lookups
CREATE INDEX IF NOT EXISTS idx_claims_claimant 
  ON merkle_claims(claimant);

-- Create index for status tracking
CREATE INDEX IF NOT EXISTS idx_claims_status 
  ON merkle_claims(status);

-- ============================================================
-- TABLE: sentio_sync_log
-- Purpose: Log all sync events for audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS sentio_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL, -- success, failed, pending
  payload TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  retry_count INTEGER DEFAULT 0
);

-- Create index for recent events
CREATE INDEX IF NOT EXISTS idx_sync_log_recent 
  ON sentio_sync_log(synced_at DESC);

-- Create index for failure tracking
CREATE INDEX IF NOT EXISTS idx_sync_log_failures 
  ON sentio_sync_log(status, synced_at DESC);

-- ============================================================
-- TABLE: broadcast_metadata
-- Purpose: Track broadcast timestamps and confirmation
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcast_metadata (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL UNIQUE,
  broadcast_timestamp TEXT NOT NULL,
  confirmed INTEGER DEFAULT 0,
  confirmation_timestamp TEXT,
  sentio_event_id TEXT,
  d1_confirmation TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (record_id) REFERENCES etoro_records(record_id)
);

-- ============================================================
-- VIEW: sync_status_summary
-- Purpose: Real-time sync status overview
-- ============================================================
CREATE VIEW IF NOT EXISTS sync_status_summary AS
SELECT
  COUNT(CASE WHEN synced_to_sentio = 1 THEN 1 END) as total_synced,
  COUNT(*) as total_records,
  MAX(date) as latest_record_date,
  MIN(date) as earliest_record_date,
  SUM(CASE WHEN type = 'buy' THEN amount ELSE 0 END) as total_buys,
  SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END) as total_sells,
  SUM(pnl) as total_pnl
FROM etoro_records
WHERE source = 'etoro';

-- ============================================================
-- VIEW: merkle_verification_status
-- Purpose: Merkle proof verification health check
-- ============================================================
CREATE VIEW IF NOT EXISTS merkle_verification_status AS
SELECT
  merkle_root,
  COUNT(*) as total_claims,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_claims,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
  ROUND(
    100.0 * COUNT(CASE WHEN status = 'verified' THEN 1 END) / COUNT(*),
    2
  ) as verification_success_rate
FROM merkle_claims
GROUP BY merkle_root;

-- ============================================================
-- INITIALIZATION QUERIES
-- ============================================================

-- Set processor configuration
INSERT OR REPLACE INTO global_state (key, value)
VALUES ('processor_version', '1.0.0');

INSERT OR REPLACE INTO global_state (key, value)
VALUES ('network', 'solana_devnet');

INSERT OR REPLACE INTO global_state (key, value)
VALUES ('start_block', '275000000');

INSERT OR REPLACE INTO global_state (key, value)
VALUES ('migration_started', datetime('now'));

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check initialization:
-- SELECT * FROM global_state;
-- SELECT * FROM merkle_roots;
-- SELECT * FROM sync_status_summary;
-- SELECT * FROM merkle_verification_status;
