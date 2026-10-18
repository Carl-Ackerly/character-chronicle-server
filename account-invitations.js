'use strict';
const crypto = require('node:crypto');
const digest = code => crypto.createHash('sha256').update(code).digest('hex');
function createInvitations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_invitations (
    token_hash TEXT PRIMARY KEY, issuer_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
    used_at INTEGER, account_id TEXT REFERENCES accounts(id)
  )`);
  function valid(code) {
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) return false;
    return !!db.prepare('SELECT token_hash FROM account_invitations WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(digest(code), Date.now());
  }
  function issue(actor) {
    const code = crypto.randomBytes(32).toString('hex'), expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    db.prepare('INSERT INTO account_invitations (token_hash, issuer_id, expires_at) VALUES (?, ?, ?)').run(digest(code), actor, expiresAt);
    return { code, expiresAt };
  }
  // Called inside the account-creation transaction: one code creates one account.
  function consume(code, accountId) {
    return db.prepare('UPDATE account_invitations SET used_at = ?, account_id = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').run(Date.now(), accountId, digest(code), Date.now()).changes === 1;
  }
  return { valid, issue, consume };
}
module.exports = { createInvitations };
