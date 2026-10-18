const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {createAuth}=require('./account-auth');
const {createInvitations}=require('./account-invitations');
const {createBackups,verify}=require('./account-backups');
const {encrypt,decrypt,readKey,createMirror,loadMirror,restoreEncrypted}=require('./account-cloud-backup');
const {setup}=require('./account-backup-setup');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-cloud-')),databasePath=path.join(dir,'test.db'),keyFile=path.join(dir,'recovery-key.json'),destination=path.join(dir,'mock-onedrive');
const key=crypto.randomBytes(32);fs.writeFileSync(keyFile,JSON.stringify({version:1,key:key.toString('base64')}),{mode:0o600});
const db=new DatabaseSync(databasePath);
try{
 createAuth(db);db.exec('CREATE TABLE account_books(account_id TEXT PRIMARY KEY REFERENCES accounts(id), data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)');
 db.prepare('INSERT INTO accounts(id,username,salt,password_hash,created_at,role) VALUES(?,?,?,?,?,?)').run('synthetic','cloud-test','salt-unchanged','hash-unchanged','2026-10-18','admin');
 const book={version:1,active:'test',characters:[{id:'test',name:'Synthetic cloud hero',notes:'PRIVATE_SYNTHETIC_STORY',sheet:{equipment:'keep'},spellbook:{prepared:['shield']},resources:{spent:2}}]};
 db.prepare('INSERT INTO account_books VALUES(?,?,?,?)').run('synthetic',JSON.stringify(book),7,'2026-10-18');
 db.prepare('INSERT INTO login_sessions VALUES(?,?,?,?)').run('hash-only-session','synthetic','csrf-token',Date.now()+60000);
 db.prepare('INSERT INTO password_resets VALUES(?,?,?,?,?)').run('hash-only-reset','synthetic','local-owner',Date.now()+60000,null);createInvitations(db).issue('local-owner');
 const originals={accounts:db.prepare('SELECT * FROM accounts').all(),books:db.prepare('SELECT * FROM account_books').all()};
 const mirror=createMirror({destination,keyFile,statusFile:path.join(dir,'mirror-status.json')}),backups=createBackups(db,databasePath,{mirror});
 const local=backups.run(true);assert(local);verify(local);
 const files=fs.readdirSync(destination);assert.equal(files.length,1);assert(files[0].endsWith('.ccbackup'));
 const encryptedPath=path.join(destination,files[0]),encrypted=fs.readFileSync(encryptedPath);assert(!encrypted.toString().includes('PRIVATE_SYNTHETIC_STORY'));assert(!encrypted.toString().includes('SQLite format'));assert(!encrypted.toString().includes(key.toString('base64')));
 assert(decrypt(encrypted,readKey(keyFile)).equals(fs.readFileSync(local)));
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'mirror-status.json'),'utf8')).uploadVerified,false);
 assert(!encrypt(fs.readFileSync(local),key).equals(encrypted));
 assert.throws(()=>decrypt(encrypted,crypto.randomBytes(32)),/Cannot decrypt/);
 const wrongKey=path.join(dir,'wrong-key.json');fs.writeFileSync(wrongKey,JSON.stringify({version:1,key:crypto.randomBytes(32).toString('base64')}));assert.throws(()=>restoreEncrypted(encryptedPath,wrongKey,path.join(dir,'wrong-restore.db')),/Cannot decrypt/);assert.equal(fs.existsSync(path.join(dir,'wrong-restore.db')),false);
 const broken=JSON.parse(encrypted);broken.ciphertext=(broken.ciphertext[0]==='A'?'B':'A')+broken.ciphertext.slice(1);assert.throws(()=>decrypt(Buffer.from(JSON.stringify(broken)),key),/Cannot decrypt/);
 const recovered=path.join(dir,'recovered.db');restoreEncrypted(encryptedPath,keyFile,recovered);verify(recovered);assert.throws(()=>restoreEncrypted(encryptedPath,keyFile,recovered),/already exists/);
 const recoveredDB=new DatabaseSync(recovered,{readOnly:true});assert.deepEqual(recoveredDB.prepare('SELECT * FROM accounts').all(),originals.accounts);assert.deepEqual(recoveredDB.prepare('SELECT * FROM account_books').all(),originals.books);
 for(const table of ['login_sessions','password_resets','account_invitations'])assert.equal(recoveredDB.prepare('SELECT COUNT(*) AS n FROM '+table+(table==='login_sessions'?'':' WHERE used_at IS NULL')).get().n,0);recoveredDB.close();
 const missingKey=path.join(dir,'missing-key.json'),retryDir=path.join(dir,'retry-upload'),retryMirror=createMirror({destination:retryDir,keyFile:missingKey});
 const warn=console.error;console.error=()=>{};
 try{
  const retry=createBackups(db,databasePath,{mirror:retryMirror});assert.equal(retry.run(),null);assert.equal(fs.existsSync(retryDir),false);
  fs.copyFileSync(keyFile,missingKey);assert.equal(retry.run(),null);assert.equal(fs.readdirSync(retryDir).length,1);
  fs.writeFileSync(encryptedPath,Buffer.from(JSON.stringify(broken)));assert.equal(mirror.sync(local),false);verify(local);
 }finally{console.error=warn;}
 assert.throws(()=>createMirror({destination:dir,keyFile}),/outside/);
 const privateFolder=path.join(dir,'private-admin');fs.mkdirSync(privateFolder);fs.writeFileSync(path.join(privateFolder,'backup-sync.json'),JSON.stringify({enabled:true,destination:path.join(dir,'configured-upload'),keyFile}));
 const configured=createBackups(db,databasePath);assert.equal(configured.run(),null);assert.equal(fs.readdirSync(path.join(dir,'configured-upload')).length,1);assert(loadMirror(databasePath));
 assert.deepEqual(db.prepare('SELECT * FROM accounts').all(),originals.accounts);assert.deepEqual(db.prepare('SELECT * FROM account_books').all(),originals.books);
 assert.equal(fs.readdirSync(dir).some(name=>name.startsWith('.cc-restore-')),false);
 const setupRoot=path.join(dir,'mock-cloud-root'),setupRepo=path.join(dir,'setup-repo');fs.mkdirSync(setupRoot);fs.mkdirSync(setupRepo);const settings=setup(setupRoot,setupRepo),originalKey=fs.readFileSync(settings.keyFile);setup(setupRoot,setupRepo);assert(fs.readFileSync(settings.keyFile).equals(originalKey));assert(!fs.readFileSync(path.join(setupRepo,'private-admin','backup-sync.json'),'utf8').includes(JSON.parse(originalKey).key));
 assert.throws(()=>setup(setupRoot,path.join(setupRoot,'bad-project')),/outside OneDrive/);
 fs.unlinkSync(settings.keyFile);assert.throws(()=>setup(setupRoot,setupRepo),/missing/);assert.equal(fs.existsSync(settings.keyFile),false);
 console.log('PASS authenticated encrypted mirror, randomized nonces, ciphertext-only uploads, wrong-key/tamper rejection, complete restore, revoked sessions/codes/invites, non-overwrite, retry without new snapshot, config loading, key separation, and unchanged source data.');
}finally{db.close();}
