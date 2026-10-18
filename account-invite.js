'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createAuth}=require('./account-auth');
const {createInvitations}=require('./account-invitations');
const {createRecovery}=require('./account-recovery');
const {createAuditFile}=require('./account-audit-file');
if(require.main===module){
 let db;
 try{
  if(process.argv.length!==3||process.argv[2]!=='create')throw Error('Usage: node account-invite.js create');
  const filename=path.join(__dirname,'character-chronicle-accounts-test.db');if(!fs.existsSync(filename))throw Error('Start the local account server once to initialize its database first.');
  db=new DatabaseSync(filename,{timeout:5000});createAuth(db);
  db.exec('BEGIN IMMEDIATE');let invite;
  try{invite=createInvitations(db).issue('local-owner');createRecovery(db).audit('local-owner',null,'invitation-issued','success');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  createAuditFile(db,path.join(__dirname,'logs/security-audit.log'))();
  console.log('Private one-use invitation:',invite.code);console.log('Expires:',new Date(invite.expiresAt).toISOString());console.log('Share privately. Do not save this code in Git, chat, or terminal transcripts.');
 }catch(error){console.error(error.message);process.exitCode=1;}finally{if(db)db.close();}
}
