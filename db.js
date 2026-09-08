const Database = require('better-sqlite3');
const db = new Database('/data/control-proxy.db');

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
}

init();
module.exports = db;
