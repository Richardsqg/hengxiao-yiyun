import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { scryptSync } from 'node:crypto';

test('Windows local mode opens admin and authenticates despite a configured HTTPS domain', async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'yiyun-local-'));
 const password='Local-test-password-739';
 const config={origin:'https://gallery.example',password:{salt:'test-salt',hash:scryptSync(password,'test-salt',32).toString('hex')},feedbackSalt:'local-test'};
 await writeFile(path.join(folder,'config.json'),JSON.stringify(config));
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['runtime/server.mjs'],{env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'0.0.0.0',LOCAL_PREVIEW:'1'},stdio:['ignore','pipe','pipe']});
 const origin=`http://127.0.0.1:${port}`;
 try{
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error(output||'Startup timed out')),15000);child.stdout.on('data',c=>{output+=c;if(output.includes('服务已启动')){clearTimeout(timer);resolve();}});child.stderr.on('data',c=>output+=c);child.once('exit',()=>{clearTimeout(timer);reject(new Error(output));});});
  assert.equal((await fetch(origin+'/admin')).status,200);
  const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(!cookie.includes('Secure'));
  assert.equal((await (await fetch(origin+'/api/session',{headers:{Cookie:cookie.split(';')[0]}})).json()).authenticated,true);
  for(const badOrigin of ['https://attacker.example','https://gallery.example',`http://localhost:${port}`])assert.equal((await fetch(origin+'/api/login',{method:'POST',headers:{Origin:badOrigin,'Content-Type':'application/json'},body:JSON.stringify({password})})).status,403);
  assert.equal(JSON.parse(await (await import('node:fs/promises')).readFile(path.join(folder,'config.json'),'utf8')).origin,config.origin);
 }finally{const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;await rm(folder,{recursive:true,force:true});}
});
