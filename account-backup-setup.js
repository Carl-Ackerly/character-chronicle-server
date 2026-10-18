'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readKey}=require('./account-cloud-backup');
function setup(root, repo=__dirname){
 if(!root||!path.isAbsolute(root)||!fs.statSync(root).isDirectory())throw Error('Choose an existing absolute OneDrive folder.');
 const cloudRoot=fs.realpathSync(root),privateFolder=path.join(repo,'private-admin');
 fs.mkdirSync(privateFolder,{recursive:true,mode:0o700});
 const relative=path.relative(cloudRoot,fs.realpathSync(privateFolder));
 if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('The recovery key must be outside OneDrive. Move the project out of OneDrive first.');
 const destination=path.join(root,'Character-Chronicle-Backups'),keyFile=path.join(privateFolder,'backup-recovery-key.json'),configFile=path.join(privateFolder,'backup-sync.json');
 const config={enabled:true,destination,keyFile};
 if(fs.existsSync(configFile)){
  const previous=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
  if(previous.enabled!==true||previous.destination!==destination||previous.keyFile!==keyFile)throw Error('A different backup configuration already exists; review it before changing destinations or keys.');
  if(!fs.existsSync(keyFile))throw Error('The configured recovery key is missing. Restore your saved key; do not generate a replacement for existing backups.');
 }
 if(fs.existsSync(keyFile))readKey(keyFile);
 else fs.writeFileSync(keyFile,JSON.stringify({version:1,key:crypto.randomBytes(32).toString('base64')},null,2)+'\n',{flag:'wx',mode:0o600});
 fs.mkdirSync(destination,{recursive:true,mode:0o700});
 if(!fs.existsSync(configFile))fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
 const guide=path.join(privateFolder,'ONEDRIVE-RECOVERY.md');
 if(!fs.existsSync(guide))fs.writeFileSync(guide,`# Private OneDrive backup recovery\n\nEncrypted snapshots: ${destination}\nRecovery key file: ${keyFile}\n\nACTION REQUIRED: Save a separate copy of the recovery key JSON in a password manager (secure note/attachment), a secure USB kept separately, or another protected offline location. The key is not uploaded with backups. If the PC fails and this is your only key copy, cloud backups cannot be decrypted. Do not share the key or commit it to Git.\n\nOneDrive must be signed in and finish syncing. A local encrypted file is not proof of cloud upload. Check OneDrive for upload errors and the green check/synced status; confirm files in your OneDrive web account before relying on them. Keep the OneDrive backup folder private and unshared.\n\nTo restore, from the server folder:\n\n    node account-backup.js restore-cloud "ENCRYPTED_FILE.ccbackup" "RECOVERY_KEY.json" "NEW_RECOVERED.db"\n\nChoose a NEW destination OUTSIDE OneDrive. This does not replace the running database. Verify the recovered copy separately and do a guided offline cutover. Restored sessions, recovery codes, and unused invitations are invalidated. Old snapshots can contain earlier passwords/roles; verify owner access before reopening the service.\n\nDo not place the live database in OneDrive. Local snapshots remain in private-backups. Only encrypted copies go to OneDrive. No automatic backup deletion is configured.\n`,{flag:'wx',mode:0o600});
 return {destination,keyFile,guide};
}
module.exports={setup};
if(require.main===module){try{if(process.argv.length!==3)throw Error('Usage: node account-backup-setup.js ABSOLUTE_ONEDRIVE_FOLDER');const result=setup(process.argv[2]);console.log('Encrypted backup destination:',result.destination);console.log('Private recovery instructions:',result.guide);console.log('Save the recovery key separately and verify OneDrive finishes uploading. Key contents were not printed.');}catch(error){console.error(error.message);process.exitCode=1;}}
