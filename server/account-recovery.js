'use strict';
const crypto = require('node:crypto');
const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');

function createRecovery(db) {
  // Additive migration: existing accounts, password hashes, books, and sessions survive.
  const columns = db.prepare('PRAGMA table_info(accounts)').all().map(row => row.name);
  if (!columns.includes('role')) db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  if (!columns.includes('credential_version')) db.exec('ALTER TABLE accounts ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    issuer_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS security_audit (
    id INTEGER PRIMARY KEY, actor_id TEXT NOT NULL, target_account_id TEXT,
    action TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL
  );`);
  const tokenRow = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?');
  function audit(actor, target, action, outcome) {
    db.prepare('INSERT INTO security_audit (actor_id, target_account_id, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)').run(actor, target || null, action, outcome, new Date().toISOString());
  }
  function issue(accountId, actorId) {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE password_resets SET used_at = ? WHERE account_id = ? AND used_at IS NULL').run(Date.now(), accountId);
      db.prepare('INSERT INTO password_resets (token_hash, account_id, issuer_id, expires_at) VALUES (?, ?, ?, ?)').run(hashToken(code), accountId, actorId, expiresAt);
      audit(actorId, accountId, 'reset-issued', 'success');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK');throw error; }
    return { code, expiresAt };
  }
  function find(code, username) {
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) return null;
    const row = tokenRow.get(hashToken(code));
    if (!row || row.used_at !== null || row.expires_at <= Date.now()) return null;
    const account = db.prepare('SELECT id, username, credential_version FROM accounts WHERE id = ?').get(row.account_id);
    return account?.username === username ? { ...row, username, credential_version: account.credential_version } : null;
  }
  function complete(code, username, expectedVersion, salt, passwordHash) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = find(code, username);
      if (!row || row.credential_version !== expectedVersion) { db.exec('ROLLBACK');return false; }
      db.prepare('UPDATE accounts SET salt = ?, password_hash = ?, credential_version = credential_version + 1 WHERE id = ?').run(salt, passwordHash, row.account_id);
      db.prepare('UPDATE password_resets SET used_at = ? WHERE account_id = ? AND used_at IS NULL').run(Date.now(), row.account_id);
      db.prepare('DELETE FROM login_sessions WHERE account_id = ?').run(row.account_id);
      db.prepare('DELETE FROM auth_limits WHERE key = ?').run('name:' + username);
      audit(row.account_id, row.account_id, 'reset-completed', 'success');
      db.exec('COMMIT');return true;
    } catch (error) { db.exec('ROLLBACK');throw error; }
  }
  return { audit, issue, find, complete };
}
module.exports = { createRecovery };
