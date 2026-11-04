import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './src/db.js';
import { createApp } from './src/app.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || join(root, 'data', 'ea-desk.db');

const db = openDb(DB_FILE);
// Read the playbook on every request so operating-model edits apply without a restart.
const app = createApp({
  db,
  get playbook() { return JSON.parse(readFileSync(join(root, 'playbook.json'), 'utf8')); },
  publicDir: join(root, 'public'),
});

createServer(app).listen(PORT, HOST, () => console.log(`EA Desk → http://${HOST}:${PORT}  (db: ${DB_FILE})`));
