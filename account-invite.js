'use strict';
// Compatibility entry point: implementation lives in server/.
module.exports = require('./server/account-invite');
if (require.main === module) module.exports.main();
