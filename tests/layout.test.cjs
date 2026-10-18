'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),{projectRoot}=require('../server/paths');
assert.equal(projectRoot,root);
for(const command of ['account-server','account-admin','account-backup','account-invite','account-backup-setup','account-backup-rotate']){
 const wrapper=require('../'+command),implementation=require('../server/'+command);assert.equal(wrapper,implementation);assert.equal(typeof wrapper.main,'function');
}
assert(fs.existsSync(path.join(root,'frontend/index.html')));assert(fs.existsSync(path.join(root,'legacy/app-preview/index.html')));
assert.equal(fs.existsSync(path.join(root,'account-preview')),false);
const {createAccountServer}=require('../account-server');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cc-layout-')),server=createAccountServer({databasePath:path.join(dir,'test.db')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal(await (await fetch(base+'/')).text(),fs.readFileSync(path.join(root,'frontend/index.html'),'utf8'));
  for(const url of ['/server/account-auth.js','/docs/ROADMAP.md','/private-admin/backup-recovery-key.json','/legacy/app-preview/index.html'])assert.equal((await fetch(base+url)).status,404);
  const config=await (await fetch(base+'/api/auth/me')).json();assert.equal(config.registrationRequiresInvite,true);
  console.log('PASS canonical frontend, import-safe root command aliases, stable project-root paths, invitation policy, and non-public server/docs/private/legacy files.');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
