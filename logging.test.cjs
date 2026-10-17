const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createAccountServer } = require('./account-server');
const { run } = require('./account-admin');
const { createRecovery } = require('./account-recovery');
const { createAuditFile } = require('./account-audit-file');
(async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-audit-')),databasePath=path.join(dir,'accounts.db'),filename=path.join(dir,'logs','security-audit.log');
  const server=createAccountServer({databasePath});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const password='Logging test passphrase!';
  async function call(route,body,login){const r=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json','X-CC-Client':'1',...(login?{Cookie:login.cookie,'X-CSRF-Token':login.csrf}:{})},body:JSON.stringify(body)});return r;}
  async function enroll(username){const r=await call('/api/auth/register',{username,password});assert.equal(r.status,201);return {...await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
  const lines=()=>fs.readFileSync(filename,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  try {
    const owner=await enroll('logging-owner'),member=await enroll('logging-member');
    const book={version:1,active:'private',characters:[{id:'private',name:'PRIVATE-CHARACTER-NEVER-LOG',hp:10,maxHp:20,classes:[],notes:'PRIVATE-STORY-NEVER-LOG'}]};
    const saved=await fetch(url+'/api/book',{method:'PUT',headers:{'Content-Type':'application/json','X-CC-Client':'1',Cookie:member.cookie,'X-CSRF-Token':member.csrf},body:JSON.stringify({accountId:member.user.id,book,revision:0})});assert.equal(saved.status,201);await saved.json();
    assert.throws(()=>run(['issue-reset','logging-member'],databasePath),/identity-verified/);
    const reset=run(['issue-reset','logging-member','--identity-verified'],databasePath);assert.equal(reset.code.length,64);
    let events=lines();assert(events.some(e=>e.action==='reset-issued'&&e.actor_id==='local-owner'&&e.target_username==='logging-member'));
    const completed=await call('/api/auth/reset',{username:'logging-member',code:reset.code,password:'NewPass8',confirmPassword:'NewPass8'});assert.equal(completed.status,200);await completed.json();
    const logout=await call('/api/auth/logout',{},owner);assert.equal(logout.status,200);await logout.json();
    run(['grant-admin','logging-owner'],databasePath);
    assert.throws(()=>run(['issue-reset','logging-owner','--identity-verified'],databasePath),/recover-admin/);
    events=lines();for(const action of ['account-created','session-started','logout','reset-issued','reset-completed','admin-granted'])assert(events.some(e=>e.action===action));
    for(const event of events){assert.equal(typeof event.timestamp,'string');assert(!Object.hasOwn(event,'password'));assert(!Object.hasOwn(event,'code'));}
    const text=fs.readFileSync(filename,'utf8');for(const secret of [password,'NewPass8',reset.code,'PRIVATE-CHARACTER-NEVER-LOG','PRIVATE-STORY-NEVER-LOG'])assert(!text.includes(secret));
    assert.equal((await fetch(url+'/logs/security-audit.log')).status,404);assert.equal((await fetch(url+'/security-audit.log')).status,404);
    const db=new DatabaseSync(databasePath);const stored=JSON.parse(db.prepare('SELECT data FROM account_books WHERE account_id=?').get(member.user.id).data);assert.deepEqual(stored,book);
    const recovery=createRecovery(db),mirror=createAuditFile(db,filename);db.exec('BEGIN');recovery.audit('local-owner',member.user.id,'rolled-back-test','success');db.exec('ROLLBACK');mirror();assert(!fs.readFileSync(filename,'utf8').includes('rolled-back-test'));
    const failurePath=path.join(dir,'blocked','audit.log');fs.mkdirSync(failurePath,{recursive:true});const failed=createAuditFile(db,failurePath);const oldError=console.error;let warnings=0;try{console.error=()=>warnings++;assert.equal(failed(),false);assert.equal(failed(),false);}finally{console.error=oldError;}assert.equal(warnings,1);assert(db.prepare('SELECT COUNT(*) AS n FROM security_audit').get().n>0);
    if(process.platform!=='win32'){assert.equal(fs.statSync(filename).mode&0o777,0o600);assert.equal(fs.statSync(path.dirname(filename)).mode&0o777,0o700);}
    db.close();
    console.log('PASS private audit file, historical recovery export, lifecycle events, no secrets/character payloads, terminal reset acknowledgement, admin safeguards, rollback integrity, and retained DB audit after file-write failure.');
  } finally {await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
