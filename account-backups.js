'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const DAY = 24 * 60 * 60 * 1000;
function verify(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const checks = db.prepare('PRAGMA integrity_check').all();
    if (checks.length !== 1 || Object.values(checks[0])[0] !== 'ok') throw Error('Database integrity check failed.');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Database relationship check failed.');
    for (const table of ['accounts','account_books','login_sessions','password_resets','security_audit']) {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) throw Error('Not a complete account database.');
    }
  } finally { db.close(); }
}
function createBackups(db, databasePath, options = {}) {
  const directory = options.directory || path.join(path.dirname(databasePath), 'private-backups');
  const prefix = 'accounts-' + crypto.createHash('sha256').update(path.resolve(databasePath)).digest('hex').slice(0,12) + '-';
  const interval = options.interval || DAY;
  let last = 0, warned = false;
  try {
    const entries = fs.readdirSync(directory).filter(name => name.startsWith(prefix) && name.endsWith('.sqlite')).map(name => ({ filename:path.join(directory,name), modified:fs.statSync(path.join(directory,name)).mtimeMs })).sort((a,b)=>b.modified-a.modified);
    for (const entry of entries) { try { verify(entry.filename);last = entry.modified;break; } catch {} }
  } catch {}
  function run(force = false) {
    if (!force && Date.now() - last < interval) return null;
    let partial;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const filename = path.join(directory, prefix + new Date().toISOString().replace(/[:.]/g,'-') + '-' + crypto.randomBytes(4).toString('hex') + '.sqlite');
      partial = filename + '.partial';
      db.prepare('VACUUM INTO ?').run(partial);
      fs.chmodSync(partial, 0o600);verify(partial);fs.renameSync(partial, filename);
      last = Date.now();warned = false;return filename;
    } catch {
      if (!warned) console.error('Automatic database backup failed. Existing data and earlier backups are retained; check private backup storage.');
      warned = true;return false;
    } finally { if (partial) { try { fs.unlinkSync(partial); } catch {} } }
  }
  return { run, directory };
}
// Restore only to a NEW file. Never replace a running or existing database.
function restore(source, destination) {
  if (fs.existsSync(destination)) throw Error('Restore destination already exists; nothing was overwritten.');
  verify(source);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);fs.chmodSync(destination, 0o600);
  const db = new DatabaseSync(destination);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.exec('DELETE FROM login_sessions');
    db.prepare('UPDATE password_resets SET used_at = ? WHERE used_at IS NULL').run(Date.now());
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_invitations'").get()) db.prepare('UPDATE account_invitations SET used_at = ? WHERE used_at IS NULL').run(Date.now());
    db.prepare('INSERT INTO security_audit (actor_id, target_account_id, action, outcome, created_at) VALUES (?, NULL, ?, ?, ?)').run('local-owner','database-restored','success',new Date().toISOString());
    db.exec('COMMIT');
  } catch(error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
  verify(destination);return destination;
}
module.exports = { createBackups, restore, verify };
