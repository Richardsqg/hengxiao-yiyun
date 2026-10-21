import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './open-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const data = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
  const session = JSON.parse(await readFile(path.join(data, 'desktop-session.json'), 'utf8'));
  const origin = new URL(session.origin).origin;
  const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(5000) });
  if (!response.ok || !(await response.json()).ok) throw new Error('服务没有响应。');
  console.log(`展馆主网页：${origin}/\n二维码与入口：${origin}/connect\n管理员后台：${origin}/admin`);
  await openBrowser(origin + '/connect');
} catch {
  console.error('请先双击同一项目里的 Windows_同WiFi扫码启动.bat，保持服务窗口开启，再打开入口。');
  process.exitCode = 1;
}
