import { networkInterfaces } from 'node:os';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMediaSupplement } from './install-media-supplement.mjs';
import { connectPage } from '../runtime/connect-page.mjs';
import { openBrowser } from './open-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function lanAddresses(interfaces = networkInterfaces()) {
  const priority = name => /^(en0|wi-?fi|wlan\d*|wireless)/i.test(name) ? 0 : /^(en\d+|ethernet|eth\d+)/i.test(name) ? 1 : 2;
  return Object.entries(interfaces)
    .sort(([a], [b]) => priority(a) - priority(b) || a.localeCompare(b))
    .flatMap(([name, entries]) => /^(utun|tun|tap|tailscale|docker|veth|br-)|virtual|vmware|zerotier|wireguard|clash|sing-box/i.test(name) ? [] : (entries || [])
      .filter(item => !item.internal && (item.family === 'IPv4' || item.family === 4))
      .filter(item => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
      .map(item => ({ name, address: item.address })));
}

async function start() {
  const version = process.versions.node.split('.').map(Number);
  if (version[0] !== 24 || version[1] < 15) throw new Error('请使用 Node.js 24.15 或更高的24.x版本。');
  await installMediaSupplement();
  const lan = process.argv.includes('--lan');
  const addresses = lanAddresses();
  let selected = process.env.LAN_IP || addresses[0]?.address;
  if (lan && addresses.length > 1 && !process.env.LAN_IP) {
    console.log('发现多个网络地址，请选择手机所在校园网能够访问的地址。连接网线时优先确认对应的有线网卡。');
    addresses.forEach((item,index)=>console.log(`${index+1}. ${item.name}：${item.address}`));
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const input=createInterface({input:process.stdin,output:process.stdout});
      try { const choice=Number((await input.question('选择地址 [回车选1]：')).trim()||'1');if(!Number.isInteger(choice)||!addresses[choice-1])throw new Error('没有这个网络地址，请重新启动选择。');selected=addresses[choice-1].address; }
      finally { input.close(); }
    } else console.log('本次使用第一个地址；如需指定网卡，可设置LAN_IP为实际地址后启动。');
  }
  if (lan && !addresses.some(item => item.address === selected)) throw new Error('未找到局域网地址。请先让电脑连上路由器 Wi-Fi 或网线，再启动。');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 应为1至65535之间的端口号。');
  const host = lan ? '0.0.0.0' : '127.0.0.1';
  const origin = `http://${lan ? selected : '127.0.0.1'}:${port}`;
  const probe = net.createServer();
  probe.listen(port, host);
  try { await once(probe, 'listening'); }
  catch { throw new Error(`端口${port}已被占用。请先关闭旧展馆启动窗口，再重新启动本次入口。`); }
  await new Promise(resolve => probe.close(resolve));
  const data = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
  process.env.DATA_DIR = data;
  try { await access(path.join(data, 'config.json')); }
  catch {
    console.log('原包尚未配置管理员；仅首次需要按提示设置。已有配置不会重新设置。');
    const configured = spawnSync(process.execPath, [path.join(root, 'scripts/configure.mjs'), '--local'], { cwd: root, env: process.env, stdio: 'inherit' });
    if (configured.status !== 0) throw new Error('首次配置未完成，服务未启动。');
  }
  process.env.PORT = String(port);
  process.env.HOST = host;
  process.env.LOCAL_PREVIEW = '0';
  // Only this process uses the local address; the saved domain, password and data stay intact.
  const { config, gallery } = await import('../runtime/storage.mjs');
  config.origin = origin;
  const { server } = await import('../runtime/server.mjs');
  if (!server?.listening) await once(server, 'listening');
  const actual = server.address();
  if (!actual || actual.address !== host || actual.port !== port) {
    server.close();
    throw new Error('原包未按所选模式监听，服务已停止。请保留原包并提供启动报错。');
  }
  let openTarget = origin + (process.argv.includes('--admin') ? '/admin' : '');
  if (lan) {
    const html = connectPage(origin);
    await mkdir(data, { recursive: true, mode: 0o700 });
    const connect = path.join(data, 'lan-connect.html');
    await writeFile(connect, html, { mode: 0o600 });
    openTarget = origin + '/connect';
    console.log(`同 Wi-Fi 手机地址：${origin}\n扫码页：${connect}`);
  }
  console.log(`本次补充已启用：横小艺韵1.4.4，91帧按需加载与网络重试。${origin}\n请保持此窗口开启；按 Control+C 关闭服务。`);
  console.log(`管理员后台：${origin}/admin`);
  console.log(`展馆主网页：${origin}/\n二维码与入口：${origin}/connect\n当前数据目录：${data}`);
  const first = (await gallery()).videos.find(video => video.slot === 1);
  if (first?.url?.startsWith('/api/media/videos/')) {
    console.log(`影片1当前来源：后台已上传的视频${first.hidden ? '（当前设为隐藏）' : ''}。`);
  } else if (first?.url === '/assets/film-01-qiasi.mp4') {
    console.log('影片1当前来源：已手动导入的本地视频。');
  } else if (first?.url === '/assets/film-01-qiasi-20261019-v2.mp4') {
    console.log('影片1当前来源：本包内置用户提供的113秒掐丝珐琅视频。');
  } else {
    console.log('影片1当前使用内置导览。可在管理员后台“影片与360°”上传替换，无需手动放入文件夹。');
  }
  await writeFile(path.join(data, 'desktop-session.json'), JSON.stringify({ origin }) + '\n', { mode: 0o600 });
  if (process.platform === 'darwin') {
    const awake=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});
    awake.on('error',()=>console.warn('未能启动防闲置休眠，请手动保持电脑接电、开盖且不休眠。'));
  }
  if (lan) {
    let warned=false;
    const monitor=setInterval(()=>{const present=lanAddresses().some(item=>item.address===selected);if(!present&&!warned){console.warn('当前扫码IP已不在本机网卡上，原二维码可能失效。请停止服务、重新连接校园网后启动并更换二维码。');warned=true;}if(present)warned=false;},15000);
    monitor.unref();
    console.log('跨楼层请先让手机打开“二维码与入口”中的连接自检；同一Wi-Fi名称不保证网段互通。');
  }
  if (['darwin', 'win32'].includes(process.platform) && !process.argv.includes('--no-open')) await openBrowser(openTarget);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => { console.error(error.message); process.exitCode = 1; });
}
