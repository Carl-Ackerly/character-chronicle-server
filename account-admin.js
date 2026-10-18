'use strict';
// Compatibility entry point: implementation lives in server/.
module.exports = require('./server/account-admin');
if (require.main === module) module.exports.main();
