'use strict';
// Compatibility entry point: implementation lives in server/.
module.exports = require('./server/account-backup');
if (require.main === module) module.exports.main();
