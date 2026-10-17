const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAccountServer}=require('./account-server');
const {chromium,launchOptions}=require('./tests/browser-runtime.cjs');
const {DatabaseSync}=require('node:sqlite');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-sync-')),server=createAccountServer({databasePath:path.join(dir,'test.db')});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
  const url='http://127.0.0.1:'+server.address().port;
  const call=(route,method,body,auth)=>fetch(url+route,{method,headers:{'Content-Type':'application/json','X-CC-Client':'1',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const reg=await call('/api/auth/register','POST',{username:'sync-test',password:'Synthetic-sync!'});const auth=await reg.json();auth.cookie=reg.headers.get('set-cookie').split(';')[0];
  const book={version:1,active:'hero',characters:[{id:'hero',name:'Synthetic sync hero',classes:[{name:'Fighter',level:5,subclass:'Battle Master'}],hp:30,maxHp:40,tempHp:0,resources:{},sheet:{},spellbook:{},custom:[],sessions:[],notes:'preserve me'}]};
  assert.equal((await call('/api/book','PUT',{accountId:auth.user.id,revision:0,book},auth)).status,201);
  browser=await chromium.launch(launchOptions);
  async function device(){const ctx=await browser.newContext();await ctx.addCookies([{name:'cc_local_session',value:auth.cookie.split('=')[1],url,httpOnly:true,sameSite:'Strict'}]);await ctx.addInitScript(id=>sessionStorage.setItem('cc-account-context-v1',id),auth.user.id);const p=await ctx.newPage();await p.goto(url+'/#book');await p.locator('[data-resume]').waitFor();return {ctx,p};}
  const a=await device(),b=await device(),key='cc-account-book:'+auth.user.id;
  const value=()=>({key});
  async function battle(p){await p.locator('[data-resume]').click();await p.locator('[data-book-nav="battle"]').click();}
  await battle(a.p);await a.p.locator('#tempHp').fill('6');await a.p.locator('#tempHp').blur();await a.p.getByText('Account book saved · sync-test',{exact:true}).waitFor();
  await b.p.waitForFunction(({key})=>JSON.parse(localStorage.getItem(key))?.characters[0].tempHp===6,value(),{timeout:25000});
  await battle(b.p);await b.ctx.setOffline(true);await b.p.locator('#tempHp').fill('9');await b.p.locator('#tempHp').blur();await b.p.getByText('Saved on this device; account sync pending.',{exact:true}).waitFor();
  await a.p.locator('#tempHp').fill('7');await a.p.locator('#tempHp').blur();
  await a.p.waitForFunction(({key})=>JSON.parse(localStorage.getItem('cc-account-sync:'+key.slice('cc-account-book:'.length)))?.baseline===localStorage.getItem(key),value());
  await b.ctx.setOffline(false);await b.p.getByRole('button',{name:'Review sync conflict',exact:true}).waitFor({timeout:25000});
  assert.equal(await b.p.evaluate(key=>JSON.parse(localStorage.getItem(key)).characters[0].tempHp,key),9);
  await b.p.getByRole('button',{name:'Review sync conflict',exact:true}).click();await b.p.getByRole('button',{name:'Use this device’s changes',exact:true}).click();
  await b.p.getByText('Account book saved · sync-test',{exact:true}).waitFor();
  const remote=await (await call('/api/book','GET',null,auth)).json();assert.equal(remote.book.characters[0].tempHp,9);
  const pairs=await b.p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('cc-conflict-backup:')).map(k=>JSON.parse(localStorage.getItem(k))));assert.equal(pairs.length,1);assert.equal(pairs[0].device.characters[0].tempHp,9);assert.equal(pairs[0].server.characters[0].tempHp,7);
  // Simulate a committed save whose response never reaches the browser.
  await b.p.route('**/api/book',async route=>{if(route.request().method()==='PUT'){await route.fetch();await route.abort('failed');await b.p.unroute('**/api/book');}else await route.continue();});
  await b.p.locator('#tempHp').fill('11');await b.p.locator('#tempHp').blur();await b.p.getByText('Saved on this device; account sync pending.',{exact:true}).waitFor();
  await b.p.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.p.getByText('Account book saved · sync-test',{exact:true}).waitFor();
  assert.equal((await (await call('/api/book','GET',null,auth)).json()).book.characters[0].tempHp,11);
  // The server choice also preserves both copies before replacing the local book.
  await b.ctx.setOffline(true);await b.p.locator('#tempHp').fill('12');await b.p.locator('#tempHp').blur();await b.p.getByText('Saved on this device; account sync pending.',{exact:true}).waitFor();
  const newer=await (await call('/api/book','GET',null,auth)).json();newer.book.characters[0].tempHp=13;
  assert.equal((await call('/api/book','PUT',{accountId:auth.user.id,revision:newer.revision,book:newer.book},auth)).status,200);
  await b.ctx.setOffline(false);await b.p.getByRole('button',{name:'Review sync conflict',exact:true}).waitFor({timeout:25000});await b.p.getByRole('button',{name:'Review sync conflict',exact:true}).click();await b.p.getByRole('button',{name:'Use saved account changes',exact:true}).click();
  await b.p.waitForFunction(({key})=>JSON.parse(localStorage.getItem(key))?.characters[0].tempHp===13,value());await b.p.locator('[data-resume]').waitFor();
  assert.equal(await b.p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('cc-conflict-backup:')).length),2);
  // Expiry preserves pending changes and offers a direct sign-in path.
  await battle(b.p);await b.ctx.setOffline(true);await b.p.locator('#tempHp').fill('14');await b.p.locator('#tempHp').blur();await b.p.getByText('Saved on this device; account sync pending.',{exact:true}).waitFor();
  const db=new DatabaseSync(path.join(dir,'test.db'));db.exec('DELETE FROM login_sessions');db.close();
  await b.ctx.setOffline(false);await b.p.getByRole('button',{name:'Sign in again',exact:true}).waitFor({timeout:25000});
  assert.equal(await b.p.evaluate(key=>JSON.parse(localStorage.getItem(key)).characters[0].tempHp,key),14);
  await b.p.getByRole('button',{name:'Sign in again',exact:true}).click();await b.p.locator('#homeSignIn input[name=username]').fill('sync-test');await b.p.locator('#homePassword').fill('Synthetic-sync!');await b.p.locator('#homeSignIn button[type=submit]').click();await b.p.getByText('Account book saved · sync-test',{exact:true}).waitFor();
  assert.equal(await b.p.evaluate(key=>JSON.parse(localStorage.getItem(key)).characters[0].tempHp,key),14);
  const errors=[];b.p.on('pageerror',e=>errors.push(e.message));assert.deepEqual(errors,[]);
  console.log('PASS automatic second-device refresh, offline conflict safety, preserved both-version recovery, both explicit choices, lost-response reconciliation, and expired-session reauthentication with pending edits.');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
