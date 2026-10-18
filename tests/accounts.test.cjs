const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createAccountServer } = require('../server/account-server');
const { chromium, launchOptions } = require('./browser-runtime.cjs');
const PASS = 'Test-only passphrase 2026!';
const fixture = name => ({ version: 1, active: 'same-character-id', extension: { keep: true }, characters: [{ id: 'same-character-id', name, classes: [{ name: 'Wizard', level: 5, subclass: 'Evoker' }], hp: 20, maxHp: 40, tempHp: 0, resources: {}, custom: [], sessions: [], sheet: {}, spellbook: { Wizard: { added: ['magic-missile'], prepared: ['magic-missile'], custom: [{ name: 'Fixture spell', text: 'preserve' }] } }, notes: name + ' private notes' }] });
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-accounts-'));
  const databasePath = path.join(temp, 'accounts.db');
  const server = createAccountServer({registrationMode:'open', databasePath });await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  async function call(route, method = 'GET', body, login, extra = {}) {
    return fetch(url + route, { method, headers: { 'Content-Type': 'application/json', 'X-CC-Client': '1', ...(login ? { Cookie: login.cookie, 'X-CSRF-Token': login.csrf } : {}), ...extra }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  }
  async function register(username) {
    const r = await call('/api/auth/register', 'POST', { username, password: PASS });assert.equal(r.status, 201);
    const data = await r.json(), cookie = r.headers.get('set-cookie');assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));
    return { ...data, cookie: cookie.split(';')[0] };
  }
  let browser;
  try {
    assert.equal((await call('/api/book')).status, 401);
    assert.equal((await call('/api/auth/register', 'POST', { username: 'short', password: 'short' })).status, 400);
    assert.equal((await call('/api/auth/login', 'POST', '{bad')).status, 400);
    assert.equal((await call('/api/auth/login', 'POST', { username: 'valid', password: PASS }, null, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/api/auth/login', 'POST', { username: 'valid', password: PASS }, null, { 'X-CC-Client': '' })).status, 403);
    assert.equal((await call('/api/auth/login', 'POST', { username: 'valid', password: 'x'.repeat(5000) })).status, 413);
    assert.equal(await new Promise((resolve,reject)=>{require('node:http').get(url+'/api/book',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)}),421);
    const alice = await register('alice-test'), bob = await register('bob-test');
    assert.equal((await call('/api/auth/login', 'POST', { username: 'alice-test', password: 'Incorrect test passphrase' })).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', { username: 'nobody-test', password: 'Incorrect test passphrase' })).status, 401);
    const a = fixture('Alice Hero'), b = fixture('Bob Hero');
    const put = (login, book, revision = 0, accountId = login.user.id, headers = {}) => call('/api/book', 'PUT', { book, revision, accountId }, login, headers);
    assert.equal((await put(alice, a)).status, 201);
    assert.equal((await put(bob, b)).status, 201);
    assert.deepEqual((await (await call('/api/book', 'GET', undefined, alice)).json()).book, a);
    assert.deepEqual((await (await call('/api/book', 'GET', undefined, bob)).json()).book, b);
    assert.equal((await put(bob, a, 1, alice.user.id)).status, 403);
    assert.equal((await put(alice, a, 1, alice.user.id, { 'X-CSRF-Token': 'incorrect' })).status, 403);
    assert.equal((await put(alice, a, 0)).status, 409);
    assert.equal((await call('/api/book/' + alice.user.id, 'GET', undefined, bob)).status, 404);
    assert.equal((await call('/character-chronicle-accounts-test.db')).status, 404);
    assert.equal((await call('/account-auth.js')).status, 404);
    const verify = new DatabaseSync(databasePath);const users = verify.prepare('SELECT salt, password_hash FROM accounts').all();assert.equal(users.length,2);assert.notEqual(users[0].salt,users[1].salt);assert.notEqual(users[0].password_hash,users[1].password_hash);assert(!fs.readFileSync(databasePath).includes(Buffer.from(PASS)));verify.close();
    const loginResponse=await call('/api/auth/login','POST',{username:'alice-test',password:PASS},alice);assert.equal(loginResponse.status,200);const fresh={...await loginResponse.json(),cookie:loginResponse.headers.get('set-cookie').split(';')[0]};assert.notEqual(fresh.cookie,alice.cookie);assert.equal((await call('/api/book','GET',undefined,alice)).status,401);
    assert.equal((await call('/api/auth/logout','POST',{},fresh,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await call('/api/auth/logout','POST',{},fresh)).status,200);assert.equal((await call('/api/book','GET',undefined,fresh)).status,401);
    const expire = new DatabaseSync(databasePath);expire.prepare('UPDATE login_sessions SET expires_at = 0 WHERE account_id = ?').run(bob.user.id);expire.close();assert.equal((await call('/api/book','GET',undefined,bob)).status,401);
    browser=await chromium.launch(launchOptions);const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const guest=fixture('Guest stays local');await ctx.addInitScript(book=>{if(!localStorage.getItem('combat-tracker-prototype-v1'))localStorage.setItem('combat-tracker-prototype-v1',JSON.stringify(book));},guest);
    await page.goto(url);await page.getByText('Device-only mode · no account required',{exact:true}).waitFor();assert.equal(await page.locator('[data-resume]').count(),1);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#homeSignIn input[name=username]').fill('alice-test');await page.locator('#homeSignIn input[name=password]').fill(PASS);await page.locator('#homeSignIn button[type=submit]').click();
    await page.getByText('Account book saved · alice-test',{exact:true}).waitFor();assert(await page.locator('[data-resume]').innerText().then(s=>s.includes('Alice Hero')));assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1'))),guest);assert.equal(await page.evaluate(()=>document.cookie.includes('cc_local_session')),false);
    assert.equal(await page.locator('main').isVisible(),true);assert.equal(await page.locator('.chronicle-home').isVisible(),false);assert.equal(await page.getByRole('button',{name:'Home',exact:true}).isVisible(),false);assert.equal(await page.getByRole('button',{name:'Review sync conflict',exact:true}).isVisible(),false);assert.equal(await page.getByRole('button',{name:'Copy device-only characters',exact:true}).isVisible(),false);await page.goto(url+'/#home');await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();assert.equal(await page.locator('.chronicle-home').isVisible(),false);await page.locator('[data-resume]').click();await page.locator('[data-book-nav="battle"]').click();await page.locator('#tempHp').fill('6');await page.locator('#tempHp').blur();
    let remote;for(let i=0;i<50;i++){const cookies=await ctx.cookies();remote=await (await call('/api/book','GET',undefined,{cookie:cookies.map(c=>c.name+'='+c.value).join(';')})).json();if(remote.book?.characters[0].tempHp===6)break;await new Promise(r=>setTimeout(r,100));}assert.equal(remote.book.characters[0].tempHp,6);assert.deepEqual(remote.book.characters[0].spellbook,a.characters[0].spellbook);
    // A different tab logs into Bob; the old Alice tab must not upload into Bob.
    const second=await ctx.newPage();await second.goto(url);await second.getByRole('button',{name:'Sign in',exact:true}).click();await second.locator('#homeSignIn input[name=username]').fill('bob-test');await second.locator('#homeSignIn input[name=password]').fill(PASS);await second.locator('#homeSignIn button[type=submit]').click();await second.getByText('Account book saved · bob-test',{exact:true}).waitFor();
    await page.locator('#tempHp').fill('9');await page.locator('#tempHp').blur();await page.getByText('Account changed. Local copy kept; sign in again.',{exact:true}).waitFor();
    const cookies=await ctx.cookies();const after=await (await call('/api/book','GET',undefined,{cookie:cookies.map(c=>c.name+'='+c.value).join(';')})).json();assert.equal(after.book.characters[0].name,'Bob Hero');assert.equal(after.book.characters[0].tempHp,0);
    await second.getByRole('button',{name:'Sign out',exact:true}).click();await second.getByText('Device-only mode · no account required',{exact:true}).waitFor();assert(await second.locator('[data-resume]').innerText().then(s=>s.includes('Guest stays local')));
    for(const width of [320,650,1280]){await second.setViewportSize({width,height:900});assert(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    const signupContext=await browser.newContext();await signupContext.addInitScript(book=>{if(!localStorage.getItem('combat-tracker-prototype-v1'))localStorage.setItem('combat-tracker-prototype-v1',JSON.stringify(book));},guest);const signup=await signupContext.newPage();signup.on('dialog',d=>d.accept());await signup.goto(url);await signup.getByRole('button',{name:'Create test account',exact:true}).click();await signup.locator('dialog input[name=username]').fill('charlie-test');await signup.locator('dialog input[name=password]').fill(PASS);await signup.locator('dialog input[name=confirmPassword]').fill('Different test passphrase');await signup.locator('dialog button[type=submit]').click();await signup.getByText('Passphrases do not match. Please check both fields.',{exact:true}).waitFor();await signup.getByRole('dialog').getByLabel('Show passphrase',{exact:true}).check();assert.equal(await signup.locator('dialog input[name=password]').getAttribute('type'),'text');assert.equal(await signup.locator('dialog input[name=confirmPassword]').getAttribute('type'),'text');await signup.locator('dialog input[name=confirmPassword]').fill(PASS);await signup.getByRole('dialog').getByLabel('Show passphrase',{exact:true}).uncheck();assert.equal(await signup.locator('dialog input[name=password]').getAttribute('type'),'password');await signup.locator('dialog button[type=submit]').click();await signup.getByText('Account book saved · charlie-test',{exact:true}).waitFor();assert.equal(await signup.locator('[data-resume]').count(),0);await signup.getByRole('button',{name:'Copy device-only characters',exact:true}).click();await signup.locator('[data-resume]').waitFor();assert(await signup.locator('[data-resume]').innerText().then(s=>s.includes('Guest stays local')));assert.deepEqual(await signup.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1'))),guest);await signup.locator('[data-resume]').click();await signup.locator('[data-book-nav="battle"]').click();await signupContext.setOffline(true);await signup.locator('#tempHp').fill('4');await signup.locator('#tempHp').blur();await signup.getByText('Saved on this device; account sync pending.',{exact:true}).waitFor();await signupContext.setOffline(false);assert.equal(await signup.getByRole('button',{name:'Review sync conflict',exact:true}).isVisible(),false);const newCookies=await signupContext.cookies();let updated;for(let i=0;i<50;i++){updated=await (await call('/api/book','GET',undefined,{cookie:newCookies.map(c=>c.name+'='+c.value).join(';')})).json();if(updated.book?.characters[0].tempHp===4)break;await new Promise(r=>setTimeout(r,100));}assert.equal(updated.book.characters[0].tempHp,4);await signupContext.close();
    assert.deepEqual(errors,[]);
    // Persisted throttling returns 429 even across otherwise valid JSON requests.
    let limited=false;for(let i=0;i<12;i++){const r=await call('/api/auth/login','POST',{username:'nobody-rate-test',password:PASS});if(r.status===429){limited=true;break;}}assert(limited);
    console.log('PASS account isolation, password hashing/salts, session rotation/logout/expiry, CSRF/origin/Host/body defenses, rate limits, guest preservation, existing dashboard sync, stale-tab account-switch protection, and responsive browser UI.');
  } finally { if(browser)await browser.close();await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1});
