const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAccountServer}=require('../server/account-server');
const {chromium,launchOptions}=require('./browser-runtime.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-book-theme-'));
 const server=createAccountServer({databasePath:path.join(dir,'test.db'),registrationMode:'open'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const character=(id,name,theme)=>({id,name,theme,classes:[{name:'Fighter',level:1}],hp:10,maxHp:10,tempHp:0,resources:{},custom:[],sessions:[],sheet:{},notes:''});
 try{
  browser=await chromium.launch(launchOptions);const context=await browser.newContext();const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);
  await page.evaluate(book=>localStorage.setItem('combat-tracker-prototype-v1',JSON.stringify(book)),{version:1,characters:[character('one','Theme One','siege'),character('two','Theme Two','royal')],active:'one'});
  await page.reload();await page.getByRole('button',{name:'Use on this device',exact:true}).click();
  await page.locator('[data-resume="one"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'siege');
  await page.locator('[data-theme-picker]').selectOption('frost');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')).characters[0].theme),'frost');
  await page.reload();await page.locator('[data-resume="one"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'frost');
  await page.locator('#bookBack').click();await page.locator('[data-resume="two"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'royal');
  await page.locator('#bookBack').click();await page.locator('[data-resume="one"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'frost');
  // Store the same complete character book through the account API, then read it
  // from a separate authenticated client to verify themes travel with the book.
  const book=await page.evaluate(()=>JSON.parse(localStorage.getItem('combat-tracker-prototype-v1')));
  const response=await fetch(url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-CC-Client':'1'},body:JSON.stringify({username:'theme-owner',password:'Synthetic theme test'})});
  assert.equal(response.status,201);const login=await response.json();const headers={Cookie:response.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json','X-CC-Client':'1','X-CSRF-Token':login.csrf};
  assert.equal((await fetch(url+'/api/book',{method:'PUT',headers,body:JSON.stringify({accountId:login.user.id,revision:0,book})})).status,201);
  const remote=await (await fetch(url+'/api/book',{headers})).json();assert.equal(remote.book.characters[0].theme,'frost');assert.equal(remote.book.characters[1].theme,'royal');
  assert.deepEqual(errors,[]);console.log('PASS character themes survive reload, book switching and account-book round trips.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
