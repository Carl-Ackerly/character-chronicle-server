const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppServer } = require('../app-server');
const { chromium, launchOptions } = require('./browser-runtime.cjs');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronicle-test-'));
  const databasePath = path.join(dir, 'fixture.db');
  let server = createAppServer({ databasePath });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let url = 'http://127.0.0.1:' + server.address().port;
  const book = { version: 1, active: 'test-only', customExtension: { keep: true }, characters: [{ id: 'test-only', name: 'Sync Test Hero', classes: [{ name: 'Fighter', level: 5, subclass: 'Battle Master' }], hp: 17, maxHp: 60, tempHp: 2, xp: 8000, ac: 18, sheet: { str: 16, feats: [{ name: 'Alert', notes: 'keep notes' }], coins: { GP: 75 } }, spellbook: { customSource: { prepared: ['example'], custom: [{ name: 'Test spell', description: 'Preserve description' }] } }, resources: { retired: { max: 3, current: 1 } }, custom: [], sessions: [{ id: 's', name: 'Session fixture', snapshot: { notes: 'preserve' } }], notes: 'private test notes', stories: [{ text: 'Story fixture' }], unknownFutureField: { nested: [1, 2] } }] };
  const put = (data, revision) => fetch(url + '/api/book', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book: data, revision }) });
  let browser;
  try {
    assert.equal((await put(book, 0)).status, 201);
    assert.deepEqual((await (await fetch(url + '/api/book')).json()).book, book);
    assert.equal((await put({ ...book, characters: [] }, 0)).status, 400);
    assert.equal((await put(book, 0)).status, 409);
    assert.equal((await fetch(url + '/api/book', { method: 'PUT', body: '{bad' })).status, 400);
    assert.equal((await fetch(url + '/api/book', { method: 'PUT', headers: { Origin: 'https://example.com' }, body: '{}' })).status, 403);
    assert.equal((await fetch(url + '/character-chronicle-app-test.db')).status, 404);
    await new Promise(r => server.close(r));
    server = createAppServer({ databasePath });await new Promise(r => server.listen(0, '127.0.0.1', r));url = 'http://127.0.0.1:' + server.address().port;
    assert.deepEqual((await (await fetch(url + '/api/book')).json()).book, book);
    browser = await chromium.launch(launchOptions);
    const ctx = await browser.newContext();const page = await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    assert.equal(await page.locator('[data-resume]').count(), 0);
    await page.getByRole('button', { name: 'Load server copy', exact: true }).click();
    await page.locator('[data-resume]').waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('combat-tracker-prototype-v1'))), book);
    await page.locator('[data-resume]').click();await page.locator('[data-book-nav="battle"]').click();
    await page.locator('#tempHp').fill('7');await page.locator('#tempHp').blur();
    await page.getByText('Test book saved to server', { exact: true }).waitFor();
    let saved;for(let i=0;i<40;i++){saved=await (await fetch(url+'/api/book')).json();if(saved.book.characters[0].tempHp===7)break;await new Promise(r=>setTimeout(r,100));}assert.equal(saved.book.characters[0].tempHp,7);assert.deepEqual(saved.book.characters[0].spellbook,book.characters[0].spellbook);assert.deepEqual(saved.book.characters[0].sessions,book.characters[0].sessions);assert.deepEqual(saved.book.characters[0].unknownFutureField,book.characters[0].unknownFutureField);
    await ctx.setOffline(true);await page.locator('#tempHp').fill('9');await page.locator('#tempHp').blur();await page.getByText('Saved on this device; server pending. Retry Connect when available.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')).characters[0].tempHp),9);await ctx.setOffline(false);await page.getByRole('button',{name:'Connect test saves',exact:true}).click();for(let i=0;i<40;i++){saved=await (await fetch(url+'/api/book')).json();if(saved.book.characters[0].tempHp===9)break;await new Promise(r=>setTimeout(r,100));}assert.equal(saved.book.characters[0].tempHp,9);const remoteBook=structuredClone(saved.book);remoteBook.characters[0].notes='Newer remote note';assert.equal((await put(remoteBook,saved.revision)).status,200);
    await page.locator('#tempHp').fill('8');await page.locator('#tempHp').blur();await page.getByText('Conflict: local copy kept. Back up before loading server copy.',{exact:true}).waitFor();
    assert.equal((await (await fetch(url+'/api/book')).json()).book.characters[0].notes,'Newer remote note');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')).characters[0].tempHp),8);
    for(const width of [320,650,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    assert.deepEqual(errors,[]);
    console.log('PASS complete nested character round trip, persistent SQLite restart, validation, conflict protection, private routes, existing dashboard save bridge, local conflict preservation, responsive UI.');
  } finally { if(browser)await browser.close();await new Promise(r=>server.close(r)); /* Retain test fixture in temp for inspection; no user database was opened. */ }
})().catch(e=>{console.error(e);process.exitCode=1});
