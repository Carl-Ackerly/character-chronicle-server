'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// SQLite is authoritative. This file is a readable, atomic snapshot of its audit.
// Never accept request payloads here: only explicitly selected audit columns.
function createAuditFile(db, filename) {
  let lastVersion = '', warned = false;
  return function refresh() {
    let temporary;
    try {
      const version = JSON.stringify(db.prepare('SELECT COUNT(*) AS count, MAX(id) AS last_id FROM security_audit').get());
      if (version === lastVersion && fs.existsSync(filename)) return true;
      const rows = db.prepare(`SELECT e.id, e.created_at AS timestamp,
        e.actor_id, actor.username AS actor_username, e.target_account_id,
        target.username AS target_username, e.action, e.outcome
        FROM security_audit e
        LEFT JOIN accounts actor ON actor.id = e.actor_id
        LEFT JOIN accounts target ON target.id = e.target_account_id
        ORDER BY e.id`).all();
      fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      temporary = filename + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
      fs.writeFileSync(temporary, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, filename);
      lastVersion = version;warned = false;return true;
    } catch {
      if (!warned) console.error('Security audit file could not be refreshed. The database audit is retained.');
      warned = true;return false;
    } finally {
      if (temporary) { try { fs.unlinkSync(temporary); } catch {} }
    }
  };
}
module.exports = { createAuditFile };
