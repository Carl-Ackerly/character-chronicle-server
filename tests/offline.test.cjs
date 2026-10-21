'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAccountServer}=require('../server/account-server');
const {chromium,launchOptions}=require('./browser-runtime.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-offline-'));
 let server=createAccountServer({databasePath:path.join(dir,'test.db')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,base='http://127.0.0.1:'+port;let browser;
 try{
  browser=await chromium.launch(launchOptions);const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#offlineReady').waitFor({state:'attached'});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  const fixture={version:1,active:'offline-test',characters:[{id:'offline-test',name:'Offline Adventurer',classes:[{name:'Fighter',level:1}],hp:10,maxHp:10,tempHp:0,resources:{},custom:[],sessions:[],sheet:{},notes:''}]};
  await page.evaluate(book=>localStorage.setItem('combat-tracker-prototype-v1',JSON.stringify(book)),fixture);
  // Real unavailable server, with the browser still connected to the internet.
  await new Promise(r=>server.close(r));server=null;
  await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#book');await page.locator('[data-resume="offline-test"]').click();
  await page.locator('[data-book-nav="battle"]').click();
  await page.locator('#hpAmount').fill('2');await page.locator('#takeDamage').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')).characters[0].hp),8);
  await page.reload();await page.locator('[data-resume="offline-test"]').click();await page.locator('[data-book-nav="battle"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')).characters[0].hp),8);
  assert.equal(await page.evaluate(async()=>{try{await fetch('/api/auth/me');return 'unexpected-response';}catch{return 'unavailable';}}),'unavailable');
  const cached=await page.evaluate(async()=>{const results=[];for(const name of await caches.keys()){const cache=await caches.open(name);results.push(...(await cache.keys()).map(r=>new URL(r.url).pathname));}return results;});
  assert(cached.includes('/index.html'));assert(!cached.some(p=>p.startsWith('/api/')||p.includes('.db')||p.includes('private-')));
  // A network disconnection also leaves the same device-only book usable.
  await context.setOffline(true);await page.reload();await page.locator('[data-resume="offline-test"]').waitFor();
  await context.setOffline(false);
  server=createAccountServer({databasePath:path.join(dir,'test.db')});await new Promise(r=>server.listen(port,'127.0.0.1',r));
  await page.goto(base+'/#home');const response=await page.evaluate(async()=>{const r=await fetch('/api/auth/me');return {status:r.status,body:await r.json()};});assert.equal(response.status,200);assert.equal(response.body.user,null);
  assert.deepEqual(errors,[]);console.log('PASS phone-sized offline reopen, real server shutdown, local edits/reload, disconnected network, uncached account APIs, and server recovery.');
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
