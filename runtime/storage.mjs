import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { readFile, writeFile, mkdir, stat, rm, rename, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DATA=path.resolve(process.env.DATA_DIR||path.join(ROOT,'data'));
mkdirSync(DATA,{recursive:true,mode:0o700});
export const config=JSON.parse(readFileSync(path.join(DATA,'config.json'),'utf8'));
if(!config.origin||!config.password?.hash||!config.feedbackSalt)throw new Error('请先运行 node scripts/configure.mjs 完成配置。');
export const db=new DatabaseSync(path.join(DATA,'gallery.sqlite'),{timeout:5000});
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,nickname TEXT NOT NULL,rating INTEGER NOT NULL,favorite TEXT NOT NULL,topics TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'unread');
CREATE INDEX IF NOT EXISTS feedback_date_idx ON feedback(created_at);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
chmodSync(path.join(DATA,'gallery.sqlite'),0o600);
export const hash=(text)=>createHash('sha256').update(text).digest('hex');
export const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function database(){return {prepare(sql){const stmt=db.prepare(sql);let values=[];const wrapper={bind(...v){values=v;return wrapper},async first(){return stmt.get(...values)||null},async all(){return {results:stmt.all(...values)}},async run(){const r=stmt.run(...values);return {success:true,meta:{changes:Number(r.changes)}}}};return wrapper}};}
export async function setting(key){const row=db.prepare('SELECT value FROM settings WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
export async function saveSetting(key,value){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
export function isAdmin(request){const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('fenghua_session='))?.slice(16);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return false;const r=db.prepare('SELECT expires FROM sessions WHERE token=?').get(hash(raw));return !!r&&r.expires>Date.now();}
export function limit(key,max,ms){const now=Date.now();const r=db.prepare('INSERT INTO rate_limits(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN ? ELSE until END RETURNING count').get(key,now+ms,now,now,now+ms);return r.count<=max;}
export async function allowSubmission(request){return limit('feedback:'+hash(config.feedbackSalt+request.headers.get('x-internal-client-ip')),20,600000);}
export async function verifyPassword(value){if(typeof value!=='string'||value.length>128)return false;const a=await promisify(scrypt)(value,config.password.salt,32);const b=Buffer.from(config.password.hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);}
export const defaultVideos = [{"slot": 1, "title": "掐丝珐琅", "description": "掐丝珐琅课程视频 · 用户于2026年10月19日提供，约1分53秒，含音轨。", "url": "/assets/film-01-qiasi-20261019.mp4", "poster": "/assets/film-01-qiasi-20261019.jpg", "mediaRevision": "qiasi-20261019"}, {"slot": 2, "title": "陶艺篆刻", "description": "课程实拍影像 · 原陶艺视频，展现泥土塑形、釉色与作品。", "url": "/assets/film-02.mp4", "poster": "/assets/film-02.jpg"}, {"slot": 3, "title": "蓝白扎染", "description": "课程实拍影像 · 本次提供的扎染视频，感受蓝白织物的手作之美。", "url": "/assets/film-03.mp4", "poster": "/assets/film-03.jpg"}];
export async function gallery(){const crownFrames={};for(let i=1;i<=8;i++)crownFrames[String(i)]=await setting('crown-frames-'+i)||(i===1?await setting('frames'):null)||[];return {videos:await Promise.all(defaultVideos.map(async v=>({...v,...await setting('video-'+v.slot)}))),frames:crownFrames['1'],crownFrames};}

function keyPath(key){if(!/^(frames\/[a-f0-9-]+\.(jpg|png|webp)|videos\/[a-f0-9-]+\.mp4)$/.test(key))throw new Error('文件路径无效');return path.join(DATA,'media',key);}
const jobLocks=new Set();
async function withLock(id,fn){if(jobLocks.has(id))throw new Error('上传任务处理中');jobLocks.add(id);try{return await fn()}finally{jobLocks.delete(id)}}
function multipart(key,id){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('上传任务无效');const folder=path.join(DATA,'uploads',id);keyPath(key);
 async function manifest(){const m=JSON.parse(await readFile(path.join(folder,'manifest.json'),'utf8'));if(m.key!==key||Date.now()-m.created>86400000)throw new Error('上传任务已失效');return m;}
 return {uploadId:id,
 async uploadPart(part,bytes){return withLock(id,async()=>{const m=await manifest();if(!Number.isInteger(part)||part<1||part>50||bytes.byteLength>8*1024*1024||!bytes.byteLength)throw new Error('视频分片无效');if(part===1&&Buffer.from(bytes).toString('ascii',4,8)!=='ftyp')throw new Error('仅支持 MP4 文件');const etag=hash(Buffer.from(bytes));const target=path.join(folder,String(part));await writeFile(target+'.tmp',Buffer.from(bytes),{mode:0o600});await rename(target+'.tmp',target);return {partNumber:part,etag};});},
 async complete(parts){return withLock(id,async()=>{const m=await manifest();if(!Array.isArray(parts)||parts.length<1||parts.length>50)throw new Error('视频分片无效');let total=0;for(let i=0;i<parts.length;i++){if(parts[i].partNumber!==i+1)throw new Error('视频顺序不完整');const file=await readFile(path.join(folder,String(i+1)));if(hash(file)!==parts[i].etag)throw new Error('视频校验失败');if(i===0&&file.toString('ascii',4,8)!=='ftyp')throw new Error('视频格式错误');if(i<parts.length-1&&file.length!==8*1024*1024)throw new Error('视频分片不完整');total+=file.length;}if(total>400*1024*1024||total!==m.expectedSize)throw new Error('视频大小不匹配');const target=keyPath(key);await mkdir(path.dirname(target),{recursive:true,mode:0o700});const out=await open(target+'.tmp','w',0o600);try{for(let i=0;i<parts.length;i++)await out.writeFile(await readFile(path.join(folder,String(i+1))));}finally{await out.close()}await rename(target+'.tmp',target);await rm(folder,{recursive:true,force:true});return {key};});},
 async abort(){return withLock(id,async()=>{await manifest();await rm(folder,{recursive:true,force:true});});}
 };
}
export function bucket(){return {async put(key,bytes){const target=keyPath(key);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,Buffer.from(bytes),{mode:0o600});},async head(key){try{return await stat(keyPath(key))}catch{return null}},async createMultipartUpload(key,options){keyPath(key);const uploadId=randomUUID();const folder=path.join(DATA,'uploads',uploadId);await mkdir(folder,{recursive:true,mode:0o700});await writeFile(path.join(folder,'manifest.json'),JSON.stringify({key,created:Date.now(),expectedSize:options.expectedSize}),{mode:0o600});return {uploadId};},resumeMultipartUpload:multipart};}
export function cleanup(){const now=Date.now();db.prepare('DELETE FROM sessions WHERE expires<?').run(now);db.prepare('DELETE FROM rate_limits WHERE until<?').run(now);}
