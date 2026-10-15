import './restore-media.mjs';
import { createInterface } from 'node:readline/promises';
import { scryptSync, randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir,chmod,access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQrArtifacts } from '../runtime/qr.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
let old={};try{old=JSON.parse(await readFile(path.join(data,'config.json'),'utf8'))}catch{}
let rl=createInterface({input:process.stdin,output:process.stdout});
async function hidden(label){if(!process.stdin.isTTY)return rl.question(label);rl.close();process.stdout.write(label);return new Promise(resolve=>{let value='';process.stdin.setRawMode(true);process.stdin.resume();const listener=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){process.stdin.setRawMode(false);process.exit(130)}if(c==='\r'||c==='\n'){process.stdin.removeListener('data',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');rl=createInterface({input:process.stdin,output:process.stdout});resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;}};process.stdin.on('data',listener);});}
try{
console.log('凤华 · 匠彩：独立部署配置。密码不会显示，也不会上传到外部服务。');
const raw=(await rl.question(`正式网址（含 https://；本机测试可填 http://localhost:3000）${old.origin?' ['+old.origin+']':''}：`)).trim()||old.origin;
let origin;try{const u=new URL(raw);const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(!local&&u.protocol!=='https:')||!['http:','https:'].includes(u.protocol))throw 0;origin=u.origin;}catch{throw new Error('网址格式不正确。正式域名必须使用 https://，不包含子路径。');}
const password=await hidden('设置新管理员密码（至少12个字符，建议使用密码管理器生成）：');
if(password.length<12||password.length>128)throw new Error('密码长度应为12至128个字符。');if(password!==await hidden('再输入一次密码：'))throw new Error('两次密码不一致，配置未修改。');
const icp=(await rl.question(`ICP备案号（未取得可留空）${old.icp?' ['+old.icp+']':''}：`)).trim()||old.icp||'';
const police=(await rl.question('公安备案号（暂未取得可留空）：')).trim()||old.police||'';
const policeUrl=police?(await rl.question('公安备案官方查询链接（可留空）：')).trim()||old.policeUrl||'':'';
if(policeUrl){const u=new URL(policeUrl);if(u.protocol!=='https:'||!['beian.mps.gov.cn','www.beian.gov.cn'].includes(u.hostname))throw new Error('请使用公安备案官方查询链接。');}
const salt=randomBytes(32).toString('hex');const config={origin,password:{salt,hash:scryptSync(password,salt,32).toString('hex')},feedbackSalt:old.feedbackSalt||randomBytes(32).toString('hex'),icp,police,policeUrl};
await mkdir(data,{recursive:true,mode:0o700});await writeFile(path.join(data,'config.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});await chmod(path.join(data,'config.json'),0o600);
try{await access(path.join(data,'gallery.sqlite'));const db=new DatabaseSync(path.join(data,'gallery.sqlite'));db.exec('DELETE FROM sessions');db.close()}catch{}
const {svg,png}=createQrArtifacts(origin);await writeFile(path.join(data,'gallery-qr.svg'),svg);await writeFile(path.join(data,'gallery-qr.png'),png);
const host=new URL(origin).host;if(/^[a-z0-9.-]+$/.test(host)&&origin.startsWith('https://'))await writeFile(path.join(root,'deploy','Caddyfile'),`${host} {\n encode gzip\n reverse_proxy 127.0.0.1:3000\n}\n`);
console.log('配置已保存，二维码已生成在 data/gallery-qr.png 和 .svg。现在运行 npm start。域名修改后请重启服务。');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
