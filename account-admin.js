'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createAuth } = require('./account-auth');
const { createAuditFile } = require('./account-audit-file');

// Local OS ownership is the bootstrap authority. No web endpoint can grant roles.
function run(argv = process.argv.slice(2), databasePath = path.join(__dirname, 'character-chronicle-accounts-test.db')) {
  const [command, rawName, confirmation] = argv;
  if (!['grant-admin', 'recover-admin', 'issue-reset'].includes(command) || !rawName || (command === 'issue-reset' ? argv.length !== 3 || confirmation !== '--identity-verified' : argv.length !== 2)) throw Error('Usage: node account-admin.js grant-admin USERNAME | recover-admin USERNAME | issue-reset USERNAME --identity-verified');
  if (!fs.existsSync(databasePath)) throw Error('Account database not found. Start the account test server and create an account first.');
  const db = new DatabaseSync(databasePath, { timeout: 5000 });
  let refreshAuditFile;
  try {
    createAuth(db);
    refreshAuditFile = createAuditFile(db, path.join(path.dirname(databasePath), 'logs', 'security-audit.log'));
    const username = rawName.trim().toLowerCase();
    const account = db.prepare('SELECT id, role FROM accounts WHERE username = ?').get(username);
    if (!account) throw Error('Account not found. No account or password was changed.');
    const { createRecovery } = require('./account-recovery');const recovery = createRecovery(db);
    if (command === 'grant-admin') {
      if (account.role === 'admin') return { message: 'This account is already an administrator.' };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare("UPDATE accounts SET role = 'admin' WHERE id = ?").run(account.id);
        db.prepare('DELETE FROM login_sessions WHERE account_id = ?').run(account.id);
        recovery.audit('local-owner', account.id, 'admin-granted', 'success');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK');throw error; }
      return { message: 'Administrator role granted. Sign in again to open Account administration.' };
    }
    if (command === 'issue-reset') {
      if (account.role === 'admin') throw Error('Use recover-admin for an administrator account.');
      const reset = recovery.issue(account.id, 'local-owner');
      return { message: 'Verified-player recovery code: share privately; expires in 15 minutes and can be used once.', ...reset };
    }
    if (account.role !== 'admin') throw Error('This owner-recovery command is only for administrator accounts.');
    const reset = recovery.issue(account.id, 'local-owner');
    return { message: 'Local owner recovery code: keep private; enter it in Reset passphrase. Do not put it in Git or chat.', ...reset };
  } finally { if (refreshAuditFile) refreshAuditFile();db.close(); }
}
module.exports = { run };
if (require.main === module) {
  try { const result = run();console.log(result.message);if (result.code) { console.log('Code:', result.code);console.log('Expires:', new Date(result.expiresAt).toISOString()); } }
  catch (error) { console.error(error.message);process.exitCode = 1; }
}
