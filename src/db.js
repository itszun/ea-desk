import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS engagements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  requester TEXT,
  sponsor TEXT NOT NULL,
  domain_owner TEXT,
  delivery_team TEXT,
  problem TEXT,
  decision_needed TEXT NOT NULL,
  strategy_level TEXT,
  mode INTEGER NOT NULL,
  risk TEXT DEFAULT 'Sedang',
  slice_business TEXT, slice_data TEXT, slice_application TEXT, slice_technology TEXT,
  stage TEXT NOT NULL DEFAULT 'seed',
  status TEXT NOT NULL DEFAULT 'active',      -- active | on_hold | closed | cancelled
  target_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS checks (
  engagement_id INTEGER NOT NULL REFERENCES engagements(id),
  stage TEXT NOT NULL,
  item_id TEXT NOT NULL,
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (engagement_id, stage, item_id)
);
CREATE TABLE IF NOT EXISTS gates (
  id INTEGER PRIMARY KEY,
  engagement_id INTEGER NOT NULL REFERENCES engagements(id),
  stage TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  note TEXT,
  passed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  engagement_id INTEGER REFERENCES engagements(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Proposed',     -- Proposed | Accepted | Rejected | Superseded
  context TEXT, alternatives TEXT, decision TEXT, consequences TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner TEXT NOT NULL,
  consumer TEXT NOT NULL,
  purpose TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',        -- Draft | Disahkan | Di-harvest | Usang
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS foundation_items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT,
  source_engagement_id INTEGER REFERENCES engagements(id),
  status TEXT NOT NULL DEFAULT 'Backlog',      -- Backlog | Dikerjakan | Selesai
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,                          -- JSON: spec, method steps, templates, tools (src/products.js)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id),
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // Additive migrations for databases created by earlier POC versions.
  for (const [table, column, type] of [['engagements', 'product', 'TEXT'], ['artifacts', 'step_ref', 'TEXT'], ['foundation_items', 'product', 'TEXT']]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  return db;
}
