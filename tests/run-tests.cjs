'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const file of ['integration.test.cjs','accounts.test.cjs','recovery.test.cjs','password-change.test.cjs','sync.test.cjs','backups.test.cjs','logging.test.cjs','homepage.test.cjs','theme-buttons.test.cjs']) {
  console.log('Checking ' + file);
  const result = spawnSync(process.execPath, [file], { cwd:root, stdio:'inherit' });
  if (result.error) { console.error(result.error.message);process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS complete checkpoint regression suite.');
