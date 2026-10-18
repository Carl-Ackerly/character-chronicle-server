'use strict';
const path = require('node:path');
// Keep existing private data locations stable through source reorganization.
const projectRoot = path.resolve(__dirname, '..');
module.exports = { projectRoot };
