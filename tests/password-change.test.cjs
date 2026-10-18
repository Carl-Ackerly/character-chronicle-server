const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createAccountServer}=require('../server/account-server');
const {createRecovery}=require('../server/account-recovery');
const {chromium,launchOptions}=require('./browser-runtime.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-password-')),databasePath=path.join(dir,'test.db'),server=createAccountServer({registrationMode:'open',databasePath});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
  const url='http://127.0.0.1:'+server.address().port,OLD='Original-test!',NEW='New-123!';
  const call=(route,body,auth,headers={},method='POST')=>fetch(url+route,{method,headers:{'Content-Type':'application/json','X-CC-Client':'1',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  async function access(route,username,password){const r=await call('/api/auth/'+route,{username,password});const result=await r.json();assert([200,201].includes(r.status));return {...result,cookie:r.headers.get('set-cookie').split(';')[0]};}
  const one=await access('register','change-test',OLD),two=await access('login','change-test',OLD),other=await access('register','unaffected-test',OLD);
  const book={version:1,active:'test',characters:[{id:'test',name:'Synthetic only',classes:[{name:'Wizard',level:3}],hp:12,maxHp:24,sheet:{equipment:'keep'},spellbook:{prepared:['shield']},notes:'keep story',resources:{used:2}}]};
  assert.equal((await call('/api/book',{accountId:one.user.id,revision:0,book},one,{},'PUT')).status,201);
  const db=new DatabaseSync(databasePath);db.prepare("UPDATE accounts SET role='admin' WHERE id=?").run(one.user.id);const recovery=createRecovery(db);recovery.issue(one.user.id,'local-owner');const stored=db.prepare('SELECT * FROM account_books').all();
  const input={currentPassword:OLD,password:NEW,confirmPassword:NEW};
  assert.equal((await call('/api/auth/change-password',input)).status,401);
  assert.equal((await call('/api/auth/change-password',input,one,{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await call('/api/auth/change-password',{...input,confirmPassword:'different'},one)).status,400);
  assert.equal((await call('/api/auth/change-password',{...input,password:'Short12',confirmPassword:'Short12'},one)).status,400);
  assert.equal((await call('/api/auth/change-password',{...input,currentPassword:'Wrong-test!'},one)).status,401);
  assert.equal((await call('/api/book',undefined,one,{},'GET')).status,200);
  const changed=await call('/api/auth/change-password',input,one);assert.equal(changed.status,200);assert(changed.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await call('/api/book',undefined,one,{},'GET')).status,401);assert.equal((await call('/api/book',undefined,two,{},'GET')).status,401);assert.equal((await call('/api/book',undefined,other,{},'GET')).status,200);
  assert.equal((await call('/api/auth/login',{username:'change-test',password:OLD})).status,401);
  const fresh=await access('login','change-test',NEW);assert.equal(fresh.user.role,'admin');
  assert.deepEqual(db.prepare('SELECT * FROM account_books').all(),stored);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM password_resets WHERE account_id=? AND used_at IS NULL').get(one.user.id).count,0);
  // Simultaneous changes from the same credential version cannot both win.
  const racing=await Promise.all([call('/api/auth/change-password',{currentPassword:NEW,password:'Race-one!',confirmPassword:'Race-one!'},fresh),call('/api/auth/change-password',{currentPassword:NEW,password:'Race-two!',confirmPassword:'Race-two!'},fresh)]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,401]);
  const limited=await access('register','limited-change',OLD);
  for(let i=0;i<5;i++)assert.equal((await call('/api/auth/change-password',{...input,currentPassword:'Wrong-test!'},limited)).status,401);
  assert.equal((await call('/api/auth/change-password',input,limited)).status,429);
  browser=await chromium.launch(launchOptions);const ctx=await browser.newContext();const ui=await access('register','ui-change-test',OLD);
  await ctx.addCookies([{name:'cc_local_session',value:ui.cookie.split('=')[1],url,httpOnly:true,sameSite:'Strict'}]);await ctx.addInitScript(id=>sessionStorage.setItem('cc-account-context-v1',id),ui.user.id);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/#book');await page.getByRole('button',{name:'Account settings',exact:true}).click();
  await page.getByLabel('Current passphrase',{exact:true}).fill(OLD);await page.getByLabel('New passphrase',{exact:true}).fill(NEW);await page.getByLabel('Confirm new passphrase',{exact:true}).fill('Mismatch!');
  await page.getByRole('button',{name:'Change passphrase',exact:true}).click();await page.getByText('New passphrases do not match.',{exact:true}).waitFor();
  await page.getByLabel('Confirm new passphrase',{exact:true}).fill(NEW);
  const eye=page.getByRole('button',{name:'Hold to show new passphrase',exact:true}),box=await eye.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();assert.equal(await page.locator('#settings-password').getAttribute('type'),'text');await page.mouse.up();assert.equal(await page.locator('#settings-password').getAttribute('type'),'password');
  for(const width of [320,650,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.getByRole('button',{name:'Change passphrase',exact:true}).click();await page.getByRole('heading',{name:'Passphrase changed',exact:true}).waitFor();assert.equal(await page.locator('#settings-currentPassword').inputValue(),'');assert.equal(await page.locator('#settings-password').inputValue(),'');
  await page.getByRole('dialog').getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#homeSignIn input[name=username]').fill('ui-change-test');await page.locator('#homePassword').fill(NEW);await page.locator('#homeSignIn button[type=submit]').click();await page.getByRole('button',{name:'Account settings',exact:true}).waitFor();assert.deepEqual(errors,[]);
  const events=fs.readFileSync(path.join(dir,'logs/security-audit.log'),'utf8');assert(events.includes('password-change'));for(const secret of [OLD,NEW,'Race-one!','Race-two!'])assert(!events.includes(secret));db.close();
  console.log('PASS current-password verification, confirmation/length, CSRF/auth, throttling, concurrent-change protection, all-session/reset-code revocation, admin/book preservation, secret-free audit, settings UI, hold-to-reveal, success/sign-in, and phone widths.');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
