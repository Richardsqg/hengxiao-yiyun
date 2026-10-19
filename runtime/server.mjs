import '../scripts/restore-media.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, stat, readdir, rm, statfs } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ROOT, DATA, config, db, hash, json, gallery, isAdmin, verifyPassword, limit, cleanup } from './storage.mjs';
import { GET as adminGet, POST as adminPost } from './admin.mjs';
import { POST as feedbackPost } from './feedback.mjs';
import { contentApi,publicDocument,videoMeta } from './content.mjs';
import { createQrArtifacts } from './qr.mjs';
import { validateLanOrigin } from './preview-network.mjs';

const localPreview=process.env.LOCAL_PREVIEW==='1';
const lanPreview=process.env.LAN_PREVIEW==='1';
if(localPreview&&lanPreview)throw new Error('本机与局域网预览模式不能同时启用。');
const port=Number(process.env.PORT||3000);
const host=localPreview?'127.0.0.1':lanPreview?'0.0.0.0':process.env.HOST||'127.0.0.1';
const origin=localPreview?`http://127.0.0.1:${port}`:lanPreview?validateLanOrigin(process.env.PREVIEW_ORIGIN,port):new URL(config.origin).origin;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
const qrCache=new Map([['',createQrArtifacts(origin)]]);function qrFor(section){const selected=['crown','culture','films','voices'].includes(section)?section:'';if(!qrCache.has(selected))qrCache.set(selected,createQrArtifacts(origin+'/'+selected));return qrCache.get(selected);}
function security(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");}
async function send(res,response,head=false){res.writeHead(response.status,Object.fromEntries(response.headers));if(head){res.end();return;}if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();}
async function staticFile(req,res,file){let s;try{s=await stat(file)}catch{await send(res,json({error:'文件不存在'},404));return;}if(!s.isFile()){await send(res,json({error:'文件不存在'},404));return;}
const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':file.endsWith('.html')?'no-store':'public, max-age=3600'};let start=0,end=s.size-1,code=200;const range=req.headers.range;
if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${s.size}`});res.end();return;}if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else start=Math.max(0,s.size-Number(match[2]));if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=s.size){res.writeHead(416,{'Content-Range':`bytes */${s.size}`});res.end();return;}code=206;headers['Content-Range']=`bytes ${start}-${end}/${s.size}`;}
headers['Content-Length']=String(Math.max(0,end-start+1));res.writeHead(code,headers);if(req.method==='HEAD'||s.size===0){res.end();return;}await pipeline(createReadStream(file,{start,end}),res);}
function cookie(token='',expire=false){return `fenghua_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expire?0:28800}${origin.startsWith('https:')?'; Secure':''}`;}
async function requestBody(req,max){const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>max){const error=new Error('提交文件或内容过大');error.status=413;throw error;}chunks.push(c);}return Buffer.concat(chunks);}
async function handle(req,res){security(res);let url;try{url=new URL(req.url,origin)}catch{await send(res,json({error:'请求无效'},400));return;}const method=req.method||'GET',p=url.pathname;
if(lanPreview&&req.headers.host!==new URL(origin).host){await send(res,json({error:'请使用启动窗口显示的局域网网址访问'},403));return;}
if(!['GET','HEAD','POST'].includes(method)){await send(res,json({error:'方法不支持'},405));return;}
if(method==='POST'&&req.headers.origin!==origin){await send(res,json({error:'请从本展馆页面提交'},403));return;}
const remote=req.socket.remoteAddress||'unknown';const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote);const ip=process.env.TRUST_PROXY==='1'&&local?String(req.headers['x-forwarded-for']||remote).split(',').at(-1).trim():remote;
const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);headers.set('x-internal-client-ip',ip);
let body; if(method==='POST'){const max=p==='/api/admin'&&['frame','video-part'].includes(url.searchParams.get('action'))?9*1024*1024:['/api/content','/api/video-meta'].includes(p)?220000:p==='/api/admin'?50000:16000;if(Number(req.headers['content-length'])>max){await send(res,json({error:'提交内容过大'},413));req.resume();return;}body=await requestBody(req,max);}
const request=new Request(origin+p+url.search,{method,headers,body:method==='POST'?body:undefined});
if(p==='/api/health'){await send(res,json({ok:true}),method==='HEAD');return;}
if(p==='/api/gallery'&&method==='GET'){const preview=url.searchParams.get('preview')==='1';if(preview&&!isAdmin(request)){await send(res,json({error:'草稿预览需要管理员登录'},401));return;}const catalog=await gallery();catalog.videos=catalog.videos.map(({captions,...v})=>({...v,url:v.hidden?'':v.url,description:v.hidden?'此影片暂未开放。':v.description,captionsUrl:captions&&!v.hidden?'/api/captions/'+v.slot+'.vtt':''}));await send(res,json({...catalog,document:await publicDocument(preview),icp:config.icp||'',police:config.police||'',policeUrl:config.policeUrl||''}));return;}
if(p==='/api/operations'&&method==='GET'){if(!isAdmin(request)){await send(res,json({error:'请先登录'},401));return;}let lastBackup=null,freeGB=null;try{lastBackup=JSON.parse(await readFile(path.join(DATA,'backup-status.json'),'utf8')).completedAt}catch{}try{const disk=await statfs(DATA);freeGB=Number((disk.bavail*disk.bsize/1024**3).toFixed(1))}catch{}const databaseMB=Number(((await stat(path.join(DATA,'gallery.sqlite'))).size/1024**2).toFixed(2));await send(res,json({lastBackup,freeGB,databaseMB}));return;}
if(p==='/api/content'){await send(res,await contentApi(request));return;}
if(p==='/api/video-meta'&&method==='POST'){await send(res,await videoMeta(request));return;}
if(/^\/api\/captions\/[123]\.vtt$/.test(p)&&method==='GET'){const v=(await gallery()).videos.find(v=>v.slot===Number(p.split('/').at(-1)[0]));if(!v?.captions||v.hidden){await send(res,json({error:'字幕不存在'},404));return;}await send(res,new Response(v.captions,{headers:{'Content-Type':'text/vtt; charset=utf-8','Cache-Control':'no-store'}}));return;}
if(p==='/api/session'&&method==='GET'){await send(res,json({authenticated:isAdmin(request)}));return;}
if(p==='/api/login'&&method==='POST'){
 if(!limit('login:'+hash(config.feedbackSalt+ip),8,900000)){await send(res,json({error:'尝试次数较多，请15分钟后再试'},429));return;}
 let input;try{input=JSON.parse(body)}catch{await send(res,json({error:'请输入管理员密码'},400));return;}
 if(!await verifyPassword(input.password)){await send(res,json({error:'管理员密码不正确'},401));return;}
 const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions(token,expires) VALUES(?,?)').run(hash(token),Date.now()+28800000);cleanup();await send(res,new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(token)}}));return;
}
if(p==='/api/logout'&&method==='POST'){const token=(headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('fenghua_session='))?.slice(16);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));await send(res,new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',true)}}));return;}
if(p==='/api/feedback'&&method==='POST'){const document=await publicDocument();if(!document.feedbackOpen){await send(res,json({error:document.closedMessage},403));return;}await send(res,await feedbackPost(request));return;}
if(p==='/api/admin'){await send(res,method==='GET'?await adminGet(request):method==='POST'?await adminPost(request):json({error:'方法不支持'},405));return;}
if(p==='/api/qr.png'&&method==='GET'){await send(res,new Response(qrFor(url.searchParams.get('section')).png,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','Content-Disposition':'inline; filename="fenghua-qr.png"'}}));return;}
if(p==='/api/qr.svg'&&method==='GET'){await send(res,new Response(qrFor(url.searchParams.get('section')).svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store','Content-Disposition':'inline; filename="fenghua-qr.svg"'}}));return;}
if(p==='/api/backup'&&method==='GET'){if(!isAdmin(request)){await send(res,json({error:'请先登录'},401));return;}await send(res,json({error:'完整备份请使用部署说明中的备份命令'},400));return;}
if(p.startsWith('/api/media/')&&['GET','HEAD'].includes(method)){const key=p.slice(11);if(!/^(frames\/[a-f0-9-]+\.(jpg|png|webp)|videos\/[a-f0-9-]+\.mp4)$/.test(key)){await send(res,json({error:'文件不存在'},404));return;}await staticFile(req,res,path.join(DATA,'media',key));return;}
if(p.startsWith('/api/')){await send(res,json({error:'接口不存在'},404));return;}
if(method==='POST'){await send(res,json({error:'方法不支持'},405));return;}
if(['/','/crown','/crown/','/culture','/culture/','/films','/films/','/voices','/voices/','/admin','/admin/','/guide','/guide/','/preview','/preview/','/poster','/poster/'].includes(p)){await staticFile(req,res,path.join(ROOT,'dist','index.html'));return;}
let decoded;try{decoded=decodeURIComponent(p)}catch{await send(res,json({error:'请求无效'},400));return;}if(decoded.includes('..')||decoded.includes('\\')||decoded.split('/').some(s=>s.startsWith('.'))){await send(res,json({error:'文件不存在'},404));return;}
await staticFile(req,res,path.join(ROOT,'dist',decoded));
}
export const server=http.createServer((req,res)=>handle(req,res).catch(error=>{if(!res.headersSent){security(res);res.writeHead(error.status||500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:error.status===413?'提交内容过大':'服务暂时不可用，请稍后重试'}));}else res.destroy();console.error('Request failed:',error.code||error.name);}));
server.requestTimeout=120000;server.headersTimeout=30000;
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请关闭之前的启动窗口后重试。`:`服务启动失败：${error.message}`);process.exit(1);});
server.listen(port,host,()=>{
 console.log(`横小艺韵服务已启动。端口 ${port}，公开地址 ${origin}`);
 console.log(`管理员后台：${origin}/admin`);
 if(process.platform==='win32'&&process.argv.includes('--open-browser')){
  const target=process.argv.includes('--open-panel')&&(localPreview||lanPreview)?path.join(DATA,'打开与扫码.html'):origin+(process.argv.includes('--admin')?'/admin':'/');
  const browser=spawn('explorer.exe',[target],{stdio:'ignore'});
  browser.on('error',()=>console.error(`请在浏览器打开 ${target}`));
 }
});
const maintenance=setInterval(async()=>{cleanup();try{for(const entry of await readdir(path.join(DATA,'uploads'),{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=path.join(DATA,'uploads',entry.name);const s=await stat(folder);if(Date.now()-s.mtimeMs>86400000)await rm(folder,{recursive:true,force:true});}}catch{}},3600000);maintenance.unref();
function stop(){server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref();}process.on('SIGTERM',stop);process.on('SIGINT',stop);
