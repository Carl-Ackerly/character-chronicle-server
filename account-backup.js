'use strict';
const path = require('node:path'), fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { createBackups, restore } = require('./account-backups');
const { restoreEncrypted } = require('./account-cloud-backup');
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === 'create') {
      const filename = path.join(__dirname,'character-chronicle-accounts-test.db');
      if (!fs.existsSync(filename)) throw Error('Account database not found.');
      const db = new DatabaseSync(filename, { timeout:5000 });
      try { const result = createBackups(db,filename).run(true);if (!result) throw Error('Backup failed.');console.log('Verified private backup:',result); }
      finally { db.close(); }
    } else if (args.length === 4 && args[0] === 'restore-cloud') {
      console.log('Restored to new file:',restoreEncrypted(path.resolve(args[1]),path.resolve(args[2]),path.resolve(args[3])));
      console.log('Old sessions, reset codes, and outstanding invitations were invalidated. No running database was replaced.');
    } else if (args.length === 3 && args[0] === 'restore') {
      console.log('Restored to new file:',restore(path.resolve(args[1]),path.resolve(args[2])));
      console.log('Sessions and unused recovery codes were revoked. No running database was replaced.');
    } else throw Error('Usage: node account-backup.js create | restore BACKUP_FILE NEW_DATABASE_FILE | restore-cloud ENCRYPTED_FILE KEY_FILE NEW_DATABASE_FILE');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
