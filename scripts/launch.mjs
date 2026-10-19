import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanAddresses, validateLanOrigin } from '../runtime/preview-network.mjs';
import { createQrArtifacts } from '../runtime/qr.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, 'data', 'portable');
const args = process.argv.slice(2);
function argument(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
async function question(prompt) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await input.question(prompt)).trim(); } finally { input.close(); }
}
async function runNode(script, childArgs, env) {
  const child = spawn(process.execPath, [path.join(root, script), ...childArgs], { cwd: root, env, stdio: 'inherit' });
  const stop = () => child.kill('SIGINT');
  process.on('SIGINT', stop);
  try {
    return await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 0 : 1))); });
  } finally { process.removeListener('SIGINT', stop); }
}
async function availablePort(host, preferred, exact) {
  for (let port = preferred; port <= Math.min(65535, preferred + (exact ? 0 : 9)); port++) {
    const free = await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', error => ['EADDRINUSE', 'EACCES'].includes(error.code) ? resolve(false) : reject(error));
      probe.listen(port, host, () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error('启动端口已被占用，请关闭旧的启动窗口，或用 --port 指定其他端口。');
}

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 15) throw new Error('本软件需要 Node.js 24.15 或更高的 24.x。请使用完整便携包内的运行程序。');
  await access(path.join(root, 'dist', 'index.html'));
  if (args.includes('--lan') && args.includes('--local')) throw new Error('--lan 和 --local 不能同时使用。');
  console.log('横小艺韵 · 完整展馆与内容管理');
  let lan = args.includes('--lan');
  if (!lan && !args.includes('--local')) {
    console.log('1. 仅这台电脑查看\n2. 同一个 Wi-Fi / 局域网，电脑与手机扫码查看');
    const choice = await question('选择运行方式 [直接回车选 2]：');
    if (choice && !['1', '2'].includes(choice)) throw new Error('请输入 1 或 2 后重新启动。');
    lan = choice !== '1';
  }
  let address = '127.0.0.1';
  if (lan) {
    const candidates = lanAddresses();
    if (!candidates.length) throw new Error('没有找到本机局域网 IPv4 地址。请先连接 Wi-Fi / 网线，或重启后选择“仅这台电脑”。');
    const specified = argument('--host');
    if (specified) {
      if (!candidates.some(item => item.address === specified)) throw new Error('--host 必须是这台电脑当前的局域网 IPv4 地址。');
      address = specified;
    } else if (candidates.length === 1) address = candidates[0].address;
    else {
      candidates.forEach((item, index) => console.log(`${index + 1}. ${item.name}：${item.address}`));
      const selection = Number(await question('选择与手机连接同一网络的地址 [直接回车选 1]：') || '1');
      if (!Number.isInteger(selection) || !candidates[selection - 1]) throw new Error('选择的网络地址不存在，请重新启动。');
      address = candidates[selection - 1].address;
    }
  }
  const preferred = Number(argument('--port') || '3000');
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65535) throw new Error('端口应为 1024 至 65535 之间的整数。');
  const port = await availablePort(lan ? '0.0.0.0' : '127.0.0.1', preferred, args.includes('--port'));
  const origin = lan ? validateLanOrigin(`http://${address}:${port}`, port) : `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATA_DIR: data, PORT: String(port), HOST: lan ? '0.0.0.0' : '127.0.0.1', LOCAL_PREVIEW: lan ? '0' : '1', LAN_PREVIEW: lan ? '1' : '0', PREVIEW_ORIGIN: origin };
  await mkdir(data, { recursive: true, mode: 0o700 });
  let configured = false;
  try {
    const config = JSON.parse(await readFile(path.join(data, 'config.json'), 'utf8'));
    if (!config.password?.hash || !config.feedbackSalt) throw new Error('配置缺少密码或校验信息');
    configured = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`便携数据目录的配置无法读取；已保留原文件。请先备份后检查：${data}`);
  }
  if (!configured) {
    console.log('首次运行，请在此窗口设置自己的管理员密码。密码不会显示，也不会写入项目说明。');
    const result = await runNode('scripts/configure.mjs', [lan ? '--lan' : '--local', '--portable'], env);
    if (result !== 0) throw new Error('首次配置未完成，请重新启动。');
  }
  const qr = createQrArtifacts(origin);
  await writeFile(path.join(data, 'gallery-qr.png'), qr.png);
  await writeFile(path.join(data, 'gallery-qr.svg'), qr.svg);
  const panel = path.join(data, '打开与扫码.html');
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  await writeFile(panel, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>横小艺韵 · 打开与扫码</title><style>body{margin:0;background:#102b38;color:#f3eee4;font:16px/1.8 system-ui,'Microsoft YaHei',sans-serif}main{max-width:760px;margin:auto;padding:36px 24px}h1{font-size:30px;color:#e4c990}h2{font-size:21px}a{color:#e4c990;overflow-wrap:anywhere}.card{padding:24px;margin:22px 0;border:1px solid #607880;border-radius:12px}.qr{display:block;width:240px;max-width:100%;height:auto;background:white;image-rendering:pixelated}.button{display:inline-block;border:1px solid #e4c990;padding:10px 18px;margin:8px 12px 8px 0;border-radius:6px;text-decoration:none}small{color:#c4cfce}.path{overflow-wrap:anywhere}</style><main><h1>横小艺韵 · 完整展馆</h1><p>${lan ? '手机与电脑连接同一个 Wi-Fi / 局域网，即可扫码参观，无需访问境外网站。' : '当前选择“仅这台电脑”。若需手机扫码，请关闭启动窗口后重新打开软件，选择“同一个 Wi-Fi / 局域网”。'}</p><section class="card"><h2>观众参观</h2><img class="qr" src="data:image/png;base64,${qr.png.toString('base64')}" alt="展馆参观二维码"><p><a href="${origin}/" target="_blank" rel="noopener">${origin}/</a></p><a class="button" href="${origin}/" target="_blank" rel="noopener">打开完整展馆</a><a class="button" href="${origin}/films" target="_blank" rel="noopener">观看课程视频</a><p>完整保留凤冠360展示、文化寻根、影像展厅、观展留言四个入口。</p></section><section class="card"><h2>这台电脑的内容管理</h2><a class="button" href="${origin}/admin" target="_blank" rel="noopener">管理员登录</a><a class="button" href="${origin}/poster" target="_blank" rel="noopener">打印扫码展板（需登录）</a><p>使用首次运行时由你设置的密码。登录后可编辑图文、上传图片、替换三部视频、上传真实360环绕序列、查看留言和导出 Excel。</p><p>内容、留言与密码配置保存在：<span class="path">${escape(data)}</span>。请定期备份整个目录。</p></section><p>请保持电脑开机和启动窗口开启，关闭窗口会停止展馆。${lan ? 'Windows若弹出防火墙提示，请允许“专用网络”访问。手机须连接同一个网络；切换网络后请重新启动软件生成新二维码。访客隔离或校园网络限制可能阻止手机连接，请由网络管理员协助。' : ''}</p><small>此二维码${lan ? '仅用于当前局域网' : '仅指向本机'}，外地或使用手机流量的观众不能通过它访问。公众互联网访问需要另行部署；本面板不会自动发布网站。</small></main></html>`, { mode: 0o600 });
  console.log(`\n展馆：${origin}/\n管理员后台：${origin}/admin\n扫码展板（先登录后台）：${origin}/poster`);
  console.log(`内容、留言、密码配置保存在：${data}\n二维码图片：${path.join(data, 'gallery-qr.png')}\n打开与扫码面板：${panel}`);
  if (lan) console.log('手机与电脑须连接同一个 Wi-Fi / 局域网。电脑保持开机并保留此窗口；二维码仅在当前网络内有效。\nWindows 若弹出防火墙提示，请允许“专用网络”访问。跨网络访问需要另行部署网站。');
  else console.log('当前只有这台电脑可打开；手机扫码请选择“同一个 Wi-Fi / 局域网”方式重新启动。');
  process.exitCode = await runNode('runtime/server.mjs', args.includes('--no-browser') ? [] : ['--open-browser', '--open-panel'], env);
} catch (error) {
  console.error(`启动未完成：${error.code === 'ENOENT' ? '缺少项目文件，请完整解压软件包后重试。' : error.message}`);
  process.exitCode = 1;
}
