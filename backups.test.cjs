const assert = require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createAccountServer}=require('./account-server');
const {createBackups,restore,verify}=require('./account-backups');
const {createRecovery}=require('./account-recovery');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-backups-')),databasePath=path.join(dir,'source.db');
  let server=createAccountServer({databasePath});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let restoredServer;
  try {
    const url='http://127.0.0.1:'+server.address().port;
    const response=await fetch(url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-CC-Client':'1'},body:JSON.stringify({username:'backup-owner',password:'Backup-test-only!'})});
    assert.equal(response.status,201);const auth=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
    const book={version:1,active:'fixture',extension:{unknown:'keep'},characters:[{id:'fixture',name:'Synthetic backup hero',classes:[{name:'Bard',level:7,subclass:'College of Lore'}],hp:13,maxHp:45,resources:{secondWind:2},sheet:{feats:['Custom choice'],currency:{gp:120}},spellbook:{prepared:['ice-knife'],custom:[{name:'Custom spell',text:'Synthetic details'}]},story:[{date:'2026-10-17',text:'Synthetic story'}],sessions:[{name:'Synthetic checkpoint'}]}]};
    const put=await fetch(url+'/api/book',{method:'PUT',headers:{'Content-Type':'application/json','X-CC-Client':'1',Cookie:cookie,'X-CSRF-Token':auth.csrf},body:JSON.stringify({accountId:auth.user.id,revision:0,book})});assert.equal(put.status,201);
    const db=new DatabaseSync(databasePath,{timeout:5000});
    db.prepare("UPDATE accounts SET role='admin' WHERE id=?").run(auth.user.id);
    const reset=createRecovery(db).issue(auth.user.id,'local-owner');assert(reset.code);
    const originalBook=db.prepare('SELECT * FROM account_books').all();
    const originalAccounts=db.prepare('SELECT * FROM accounts').all();
    const backups=createBackups(db,databasePath),backup=backups.run(true);assert(backup);verify(backup);
    assert.equal(backups.run(),null);assert.equal(createBackups(db,databasePath).run(),null);
    const backupRead=new DatabaseSync(backup,{readOnly:true});assert.deepEqual(backupRead.prepare('SELECT * FROM account_books').all(),originalBook);assert.deepEqual(backupRead.prepare('SELECT * FROM accounts').all(),originalAccounts);backupRead.close();
    const target=path.join(dir,'restored.db');restore(backup,target);verify(target);
    assert.throws(()=>restore(backup,target),/already exists/);
    assert.throws(()=>restore(backup,databasePath),/already exists/);
    const bad=path.join(dir,'corrupt.sqlite');fs.writeFileSync(bad,'broken');assert.throws(()=>restore(bad,path.join(dir,'bad-restore.db')));assert.equal(fs.existsSync(path.join(dir,'bad-restore.db')),false);
    const restored=new DatabaseSync(target,{readOnly:true});
    assert.deepEqual(restored.prepare('SELECT * FROM account_books').all(),originalBook);
    assert.deepEqual(restored.prepare('SELECT * FROM accounts').all(),originalAccounts);
    assert.equal(restored.prepare('SELECT COUNT(*) AS count FROM login_sessions').get().count,0);
    assert.equal(restored.prepare('SELECT COUNT(*) AS count FROM password_resets WHERE used_at IS NULL').get().count,0);restored.close();
    const blocked=path.join(dir,'not-a-directory');fs.writeFileSync(blocked,'file');const warn=console.error;console.error=()=>{};
    try { assert.equal(createBackups(db,databasePath,{directory:blocked}).run(true),false); } finally { console.error=warn; }
    assert.deepEqual(db.prepare('SELECT * FROM account_books').all(),originalBook);db.close();
    restoredServer=createAccountServer({databasePath:target});await new Promise(r=>restoredServer.listen(0,'127.0.0.1',r));
    const restoreURL='http://127.0.0.1:'+restoredServer.address().port;
    const oldSession=await fetch(restoreURL+'/api/book',{headers:{Cookie:cookie}});assert.equal(oldSession.status,401);
    const login=await fetch(restoreURL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-CC-Client':'1'},body:JSON.stringify({username:'backup-owner',password:'Backup-test-only!'})});assert.equal(login.status,200);assert.equal((await login.json()).user.role,'admin');
    const saved=await fetch(restoreURL+'/api/book',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});assert.deepEqual((await saved.json()).book,book);
    const privateRoute=await fetch(url+'/private-backups/'+path.basename(backup));assert.equal(privateRoute.status,404);
    console.log('PASS consistent backup, daily/restart scheduling, complete book and credentials preservation, non-overwriting restore, revoked sessions/codes, restored admin login, corrupt-file rejection, failure safety, and HTTP privacy.');
  } finally { if(restoredServer)await new Promise(r=>restoredServer.close(r));await new Promise(r=>server.close(r)); }
})().catch(error=>{console.error(error);process.exitCode=1});
