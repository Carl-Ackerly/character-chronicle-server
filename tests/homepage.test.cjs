const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createAccountServer } = require('../server/account-server');
const { chromium, launchOptions } = require('./browser-runtime.cjs');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-home-'));
  const server = createAccountServer({ databasePath: path.join(dir, 'test.db') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('heading', { name: 'Character Chronicle', exact: true }).waitFor();
    assert.equal(await page.locator('main').isVisible(), false);
    const password = page.locator('#homePassword'), eye = page.getByRole('button', { name: 'Hold to show passphrase', exact: true });
    await password.fill('Synthetic test only');
    assert.equal(await password.getAttribute('type'), 'password');
    const box = await eye.boundingBox();await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);await page.mouse.down();
    assert.equal(await password.getAttribute('type'), 'text');await page.mouse.up();
    assert.equal(await password.getAttribute('type'), 'password');
    await eye.focus();await page.keyboard.down('Space');assert.equal(await password.getAttribute('type'), 'text');await page.keyboard.up('Space');
    assert.equal(await password.getAttribute('type'), 'password');
    await eye.dispatchEvent('pointerdown', { button: 0, pointerId: 1 });await eye.dispatchEvent('pointercancel');
    assert.equal(await password.getAttribute('type'), 'password');
    await eye.focus();await page.keyboard.down('Enter');await password.focus();assert.equal(await password.getAttribute('type'), 'password');await page.keyboard.up('Enter');
    await password.fill('');
    assert.equal(await page.getByRole('button', { name: 'Account administration', exact: true }).isVisible(), false);
    await page.getByRole('button', { name: 'Reset passphrase', exact: true }).click();
    await page.getByRole('dialog').waitFor();await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    for (const width of [320, 650, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.screenshot({ path: path.join(dir, 'homepage-preview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Use on this device', exact: true }).click();
    await page.locator('main').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reset passphrase', exact: true }).isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isVisible(), false);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('heading', { name: 'Character Chronicle', exact: true }).waitFor();
    await page.reload();await page.getByRole('button', { name: 'Use on this device', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS homepage, local access, account controls hidden in book, recovery navigation, responsive layout, and reload.');
  } finally { if (browser) await browser.close();await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error);process.exitCode = 1; });
