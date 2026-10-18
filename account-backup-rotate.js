'use strict';
// Compatibility entry point: implementation lives in server/.
module.exports = require('./server/account-backup-rotate');
if (require.main === module) module.exports.main();
