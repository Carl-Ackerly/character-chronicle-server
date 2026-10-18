'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {readKey,keyId,decrypt,createMirror}=require('./account-cloud-backup');
const {createBackups,verify}=require('./account-backups');
function rotate(repo=__dirname){
 const privateFolder=path.join(repo,'private-admin'),config=JSON.parse(fs.readFileSync(path.join(privateFolder,'backup-sync.json'),'utf8').replace(/^\uFEFF/,''));
 if(config.enabled!==true)throw Error('Encrypted backup copying is not enabled.');
 const destination=fs.realpathSync(config.destination),keyFile=path.resolve(config.keyFile),oldKey=readKey(keyFile),oldId=keyId(oldKey);
 if(path.dirname(fs.realpathSync(keyFile))!==fs.realpathSync(privateFolder))throw Error('Unexpected recovery key location; no rotation performed.');
 const sourceDirectory=path.join(repo,'private-backups');
 // Require a fresh consistent snapshot, without exporting it using the retired key.
 const databasePath=path.join(repo,'character-chronicle-accounts-test.db');if(!fs.existsSync(databasePath))throw Error('Account database not found; no key was changed.');
 const db=new DatabaseSync(databasePath,{timeout:5000});
 try{if(!createBackups(db,path.join(repo,'character-chronicle-accounts-test.db'),{mirror:null}).run(true))throw Error('Fresh local backup failed.');}finally{db.close();}
 const sources=fs.readdirSync(sourceDirectory).filter(name=>/^accounts-[0-9a-f]{12}-.+\.sqlite$/.test(name));
 if(!sources.length)throw Error('No local snapshots to re-encrypt.');
 const oldFiles=fs.readdirSync(destination).filter(name=>name.endsWith('.'+oldId+'.ccbackup'));
 for(const name of oldFiles){
  const filename=path.join(destination,name),sourceName=name.slice(0,-('.'+oldId+'.ccbackup').length);
  if(path.dirname(path.resolve(filename))!==destination||fs.lstatSync(filename).isSymbolicLink()||!fs.lstatSync(filename).isFile()||!sources.includes(sourceName))throw Error('An old encrypted copy has no matching local snapshot; review before rotating.');
  if(!decrypt(fs.readFileSync(filename),oldKey).equals(fs.readFileSync(path.join(sourceDirectory,sourceName))))throw Error('An old backup does not match its source; review before rotating.');
 }
 const rotation='rotation-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(6).toString('hex');
 const archive=path.join(privateFolder,'retired-backup-keys',rotation),retiredCopies=path.join(sourceDirectory,'retired-cloud-copies',rotation);
 fs.mkdirSync(archive,{recursive:true,mode:0o700});fs.mkdirSync(retiredCopies,{recursive:true,mode:0o700});
 fs.copyFileSync(keyFile,path.join(archive,'previous-key.json'),fs.constants.COPYFILE_EXCL);
 const candidate=path.join(archive,'replacement-key.json');fs.writeFileSync(candidate,JSON.stringify({version:1,key:crypto.randomBytes(32).toString('base64')},null,2)+'\n',{flag:'wx',mode:0o600});
 const newId=keyId(readKey(candidate)),mirror=createMirror({destination,keyFile:candidate});
 for(const name of sources){const source=path.join(sourceDirectory,name);verify(source);if(!mirror.sync(source))throw Error('Replacement encrypted backup failed; original active key retained.');}
 // Preserve retired ciphertext locally before removing it from the synced folder.
 for(const name of oldFiles){
  const original=path.join(destination,name),retired=path.join(retiredCopies,name);fs.copyFileSync(original,retired,fs.constants.COPYFILE_EXCL);
  if(!fs.readFileSync(retired).equals(fs.readFileSync(original)))throw Error('Retired copy verification failed; original active key retained.');
 }
 const stagedKey=keyFile+'.rotation-'+crypto.randomBytes(6).toString('hex')+'.tmp';
 try{fs.copyFileSync(candidate,stagedKey,fs.constants.COPYFILE_EXCL);fs.chmodSync(stagedKey,0o600);fs.renameSync(stagedKey,keyFile);}finally{if(fs.existsSync(stagedKey))fs.unlinkSync(stagedKey);}
 const active=readKey(keyFile);if(keyId(active)!==newId)throw Error('Active key verification failed.');
 for(const name of sources){const cloud=path.join(destination,name+'.'+newId+'.ccbackup');if(!decrypt(fs.readFileSync(cloud),active).equals(fs.readFileSync(path.join(sourceDirectory,name))))throw Error('Active replacement verification failed; keep all key archives.');}
 // Exact file removals only, after their encrypted replacements and local archives verify.
 for(const name of oldFiles){const filename=path.resolve(destination,name);if(path.dirname(filename)!==destination)throw Error('Retirement path validation failed.');fs.unlinkSync(filename);}
 fs.writeFileSync(path.join(archive,'rotation-record.json'),JSON.stringify({completedAt:new Date().toISOString(),oldKeyId:oldId,newKeyId:newId,verifiedBackups:sources.length,retiredCloudCopies:oldFiles.length,bitwardenUpdatePending:true,cloudSyncVerified:false},null,2),{mode:0o600});
 const latest=sources.sort().at(-1);createMirror({destination,keyFile,statusFile:path.join(privateFolder,'backup-sync-status.json')}).sync(path.join(sourceDirectory,latest));
 return {verifiedBackups:sources.length,retiredCloudCopies:oldFiles.length};
}
module.exports={rotate};
if(require.main===module){try{const result=rotate();console.log('Replacement key activated; encrypted backups verified:',result.verifiedBackups);console.log('Old encrypted copies retired from the active OneDrive folder:',result.retiredCloudCopies);console.log('Update Bitwarden from the local recovery-key file and let OneDrive sync. No key values were printed.');}catch(error){console.error(error.message);process.exitCode=1;}}
