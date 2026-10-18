'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FORMAT = 'character-chronicle-encrypted-backup';
function readKey(filename) {
  const record = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  if (record.version !== 1 || typeof record.key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(record.key)) throw Error('Invalid backup recovery key file.');
  const key = Buffer.from(record.key, 'base64');
  if (key.length !== 32) throw Error('Invalid backup recovery key file.');
  return key;
}
const keyId = key => crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
const header = id => JSON.stringify({format:FORMAT, version:1, keyId:id});
function encrypt(bytes, key) {
  const id = keyId(key), iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(header(id)));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.from(JSON.stringify({format:FORMAT,version:1,keyId:id,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')}));
}
function decrypt(bytes, key) {
  try {
    const record = JSON.parse(bytes.toString('utf8'));
    if (record.format !== FORMAT || record.version !== 1 || record.keyId !== keyId(key)) throw Error();
    if (![record.iv,record.tag,record.ciphertext].every(v => typeof v === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(v))) throw Error();
    const iv = Buffer.from(record.iv,'base64'), tag = Buffer.from(record.tag,'base64');
    if (iv.length !== 12 || tag.length !== 16) throw Error();
    const decipher = crypto.createDecipheriv('aes-256-gcm',key,iv);
    decipher.setAAD(Buffer.from(header(record.keyId)));decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]);
  } catch { throw Error('Cannot decrypt backup: the recovery key is wrong or the encrypted file is damaged.'); }
}
function createMirror({ destination, keyFile, statusFile }) {
  if (!path.isAbsolute(destination) || !path.isAbsolute(keyFile)) throw Error('Backup mirror requires absolute paths.');
  // Never copy the recovery key into the upload directory.
  const relativeKey = path.relative(path.resolve(destination), path.resolve(keyFile));
  if (!relativeKey || (!relativeKey.startsWith('..' + path.sep) && relativeKey !== '..' && !path.isAbsolute(relativeKey))) throw Error('Recovery key must be outside the backup destination.');
  let warned = false;
  function status(value) {
    if (!statusFile) return;
    try { fs.writeFileSync(statusFile, JSON.stringify({checkedAt:new Date().toISOString(),...value},null,2),{mode:0o600}); } catch {}
  }
  function sync(filename) {
    let partial;
    try {
      const key = readKey(keyFile), source = fs.readFileSync(filename);
      const target = path.join(destination, path.basename(filename) + '.' + keyId(key) + '.ccbackup');
      if (fs.existsSync(target)) {
        if (!decrypt(fs.readFileSync(target),key).equals(source)) throw Error('Encrypted backup verification failed.');
      } else {
        const encrypted = encrypt(source,key);
        if (!decrypt(encrypted,key).equals(source)) throw Error('Encryption verification failed.');
        fs.mkdirSync(destination,{recursive:true,mode:0o700});
        partial = target + '.' + crypto.randomBytes(8).toString('hex') + '.partial';
        // Only authenticated ciphertext is ever written into the synced folder.
        fs.writeFileSync(partial,encrypted,{flag:'wx',mode:0o600});
        if (!decrypt(fs.readFileSync(partial),key).equals(source)) throw Error('Encrypted file verification failed.');
        fs.renameSync(partial,target);
      }
      warned = false;status({ok:true,encryptedFile:target,uploadVerified:false});return target;
    } catch {
      status({ok:false,message:'Encrypted mirror failed; local backups retained. Check destination, key, and OneDrive.'});
      if (!warned) console.error('Encrypted backup mirror failed. Local backups are retained; check private backup-sync status.');
      warned = true;return false;
    } finally { if(partial){try{fs.unlinkSync(partial);}catch{}} }
  }
  return { sync };
}
function loadMirror(databasePath) {
  const folder=path.join(path.dirname(databasePath),'private-admin');
  const filename=path.join(folder,'backup-sync.json');
  if(!fs.existsSync(filename))return null;
  try {
    const config=JSON.parse(fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''));
    if(config.enabled!==true)return null;
    return createMirror({destination:config.destination,keyFile:config.keyFile,statusFile:path.join(folder,'backup-sync-status.json')});
  }catch{console.error('Encrypted backup mirror configuration is invalid; local backups remain enabled.');return null;}
}
function restoreEncrypted(source,keyFile,destination) {
  if(fs.existsSync(destination))throw Error('Restore destination already exists; nothing was overwritten.');
  const plaintext=decrypt(fs.readFileSync(source),readKey(keyFile));
  const temporary=path.join(path.dirname(path.resolve(destination)),'.cc-restore-'+crypto.randomBytes(12).toString('hex')+'.sqlite');
  try {
    fs.writeFileSync(temporary,plaintext,{flag:'wx',mode:0o600});
    return require('./account-backups').restore(temporary,destination);
  }finally{try{fs.unlinkSync(temporary);}catch{}}
}
module.exports={readKey,keyId,encrypt,decrypt,createMirror,loadMirror,restoreEncrypted};
