import { networkInterfaces } from 'node:os';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installMediaSupplement } from './install-media-supplement.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function lanAddresses(interfaces = networkInterfaces()) {
  return Object.entries(interfaces)
    .sort(([a], [b]) => (a === 'en0' ? -1 : b === 'en0' ? 1 : a.localeCompare(b)))
    .flatMap(([name, entries]) => /^(utun|tun|tap|tailscale|docker|veth|br-)/.test(name) ? [] : (entries || [])
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
  const selected = process.env.LAN_IP || addresses[0]?.address;
  if (lan && !addresses.some(item => item.address === selected)) throw new Error('未找到局域网地址。请先让 Mac 连上路由器 Wi-Fi 或网线，再启动。');
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
  const { config } = await import('../runtime/storage.mjs');
  config.origin = origin;
  const { server } = await import('../runtime/server.mjs');
  if (!server?.listening) await once(server, 'listening');
  const actual = server.address();
  if (!actual || actual.address !== host || actual.port !== port) {
    server.close();
    throw new Error('原包未按所选模式监听，服务已停止。请保留原包并提供启动报错。');
  }
  let openTarget = origin;
  if (lan) {
    const { createQrArtifacts } = await import('../runtime/qr.mjs');
    const { svg } = createQrArtifacts(origin);
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>横小艺韵 · 手机扫码</title><style>body{font:20px system-ui;margin:40px auto;padding:0 24px;max-width:650px;background:#f5f2eb;color:#163745;text-align:center}svg{width:min(80vw,360px);height:auto}a{color:#124f68;word-break:break-all}p{line-height:1.7}</style><h1>手机扫码看展馆</h1><p>手机与 Mac 连接同一个路由器或 Wi-Fi，<br>用相机或微信扫描下方二维码。</p>${svg}<p><a href="${origin}">${origin}</a></p><p>Mac 上也可点击网址打开。<br>保持启动窗口开启；局域网浏览不需要翻墙。</p><p>若扫码打不开：允许 Node 接收传入连接；<br>避免使用开启访客隔离的 Wi-Fi。<br>换 Wi-Fi 后关闭启动窗口，重新启动并扫描新二维码。</p></html>`;
    await mkdir(data, { recursive: true, mode: 0o700 });
    const connect = path.join(data, 'lan-connect.html');
    await writeFile(connect, html, { mode: 0o600 });
    openTarget = pathToFileURL(connect).href;
    console.log(`同 Wi-Fi 手机地址：${origin}\n扫码页：${connect}`);
  }
  console.log(`本次补充已启用：第一组91帧凤冠。${origin}\n请保持此窗口开启；按 Control+C 关闭服务。`);
  const { firstVideoReady } = await import('../runtime/media-supplement.mjs');
  if (!firstVideoReady()) console.log('新视频尚未放入：请将原ZIP中的MP4放到 dist/assets/film-01-qiasi.mp4，然后重新启动。当前仍保留原第一部导览。');
  if (process.platform === 'darwin' && !process.argv.includes('--no-open')) {
    const browser = spawn('/usr/bin/open', [openTarget], { stdio: 'ignore' });
    browser.on('error', () => console.log(`请手动打开：${openTarget}`));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => { console.error(error.message); process.exitCode = 1; });
}
