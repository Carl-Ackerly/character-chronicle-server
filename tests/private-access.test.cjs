const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {createAccountServer} = require('../server/account-server');
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-private-'));
  const server = createAccountServer({databasePath:path.join(temp,'test.db'), registrationMode:'open', privateOrigin:'https://fixture.example.ts.net'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port = server.address().port;
  const call = (host, origin, route='/api/auth/me', body, extra={}) => new Promise((resolve,reject)=>{
    const request = http.request({host:'127.0.0.1',port,path:route,method:body?'POST':'GET',headers:{Host:host,...(origin?{Origin:origin}:{}),'Content-Type':'application/json','X-CC-Client':'1',...extra}}, res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});
    request.on('error',reject);request.end(body?JSON.stringify(body):undefined);
  });
  try {
    assert.equal((await call('fixture.example.ts.net','https://fixture.example.ts.net')).status,200);
    assert.equal((await call('evil.example',null)).status,421);
    assert.equal((await call('fixture.example.ts.net','https://evil.example')).status,403);
    assert.equal((await call('fixture.example.ts.net','http://fixture.example.ts.net')).status,403);
    assert.equal((await call('127.0.0.1:'+port,'https://fixture.example.ts.net','/api/auth/me',undefined,{'X-Forwarded-Host':'fixture.example.ts.net','X-Forwarded-Proto':'https'})).status,403);
    assert.equal((await call('fixture.example.ts.net',null,'/api/book')).status,401);
    const registration=await call('fixture.example.ts.net','https://fixture.example.ts.net','/api/auth/register',{username:'private-test',password:'Synthetic test password'});
    assert.equal(registration.status,201);
    assert(registration.headers['set-cookie'][0].includes('; Secure'));
    const local=await call('127.0.0.1:'+port,'http://127.0.0.1:'+port,'/api/auth/login',{username:'private-test',password:'Synthetic test password'});
    assert.equal(local.status,200);assert(!local.headers['set-cookie'][0].includes('; Secure'));
    console.log('PASS private HTTPS host/origin guards, forwarding spoof rejection, secure cookies and local compatibility.');
  } finally {await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
