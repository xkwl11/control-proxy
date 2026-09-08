const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Allow configuring DB path via env (DB_PATH or SERVER_DB_PATH). Default to ./data/control-proxy.db
const DB_PATH = process.env.DB_PATH || process.env.SERVER_DB_PATH || path.join(__dirname, 'data', 'control-proxy.db');
const DB_DIR = path.dirname(DB_PATH);

try {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
} catch (err) {
  console.error('Failed to ensure DB directory', DB_DIR, err);
}

let db;
try {
  db = new Database(DB_PATH);
} catch (err) {
  console.error('Failed to open database at', DB_PATH, err);
  // Fallback to in-memory DB to keep the server running; application may have reduced functionality.
  db = new Database(':memory:');
}

function init() {
  db.prepare(`CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, purpose TEXT, status TEXT, created_at INTEGER
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS invites (
    token TEXT PRIMARY KEY, nwid TEXT, expires_at INTEGER, uses_left INTEGER, created_by TEXT, created_at INTEGER
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, detail TEXT, actor TEXT, ts INTEGER
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT, created_at INTEGER
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS networks (
    id TEXT PRIMARY KEY, nwid TEXT, name TEXT, created_by TEXT, created_at INTEGER
  )`).run();
}

init();

module.exports = db;
module.exports.DB_PATH = DB_PATH;
