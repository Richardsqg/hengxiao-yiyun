import { readFile, writeFile, mkdir, copyFile, rename, stat, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function installDesktopHotfix(target, payload, options = {}) {
  const root = path.resolve(target), source = path.resolve(payload);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'fenghua-mainland' || pkg.version !== '1.4.3') throw new Error('请选择1.4.3完整部署包内含package.json、runtime、dist的项目目录。');
  const probe = net.createServer();
  probe.listen(Number(process.env.PORT || 3000), '127.0.0.1');
  try { await once(probe, 'listening'); }
  catch { throw new Error('请先在原展馆窗口按Ctrl+C停止服务；提示终止批处理时输入Y，再运行修复。'); }
  await new Promise(resolve => probe.close(resolve));
  const manifest = JSON.parse(await readFile(path.join(source, 'desktop-hotfix-manifest.json'), 'utf8'));
  const entries = [];
  for (const entry of manifest) {
    if (!/^(runtime\/(server|connect-page)\.mjs|scripts\/(start-media-supplement|open-browser|open-desktop-pages)\.mjs|web\/(Home|Dashboard|Feedback|ZoomStage)\.tsx|web\/(media-events|uuid)\.ts|web\/revision\.css|dist\/index\.html|dist\/assets\/index-[\w-]+\.(js|css)|docs\/WINDOWS_PUBLISH_HOTFIX_20261021\.md|Windows_打开入口\.bat)$/.test(entry.path)) throw new Error('修复清单含非预期路径，已停止。');
    const bytes = await readFile(path.join(source, entry.path));
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new Error('修复包校验失败：' + entry.path);
    let existing;
    try { existing = await readFile(path.join(root, entry.path)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing && sha(existing) !== entry.sha256 && !entry.before.includes(sha(existing))) {
      throw new Error('此程序文件与原1.4.3不同，已保留未覆盖：' + entry.path);
    }
    if (entry.path.endsWith('.mjs') && spawnSync(process.execPath, ['--check', '--input-type=module'], { input: bytes }).status !== 0) throw new Error('程序语法检查失败：' + entry.path);
    entries.push({ ...entry, bytes, existing });
  }
  const backupFolder = options.backupFolder || 'windows-publish-hotfix-20261021';
  if (!/^[a-z0-9-]+$/.test(backupFolder)) throw new Error('程序备份目录无效。');
  const backup = path.join(root, 'backups', backupFolder);
  for (const entry of entries) {
    const destination = path.join(root, entry.path);
    if (entry.existing && sha(entry.existing) === entry.sha256) continue;
    if (entry.existing) {
      const saved = path.join(backup, entry.path);
      await mkdir(path.dirname(saved), { recursive: true });
      try { await copyFile(destination, saved, constants.COPYFILE_EXCL); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = destination + '.hotfix-' + randomUUID();
    try { await writeFile(temporary, entry.bytes, { flag: 'wx' }); await rename(temporary, destination); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
  }
  console.log(options.successMessage || 'Windows启动与视频发布修复已安装。data、密码、留言和已上传视频未改写。');
  for (const message of options.instructions || ['请重新运行Windows_同WiFi扫码启动.bat；浏览器将打开网页形式的二维码入口。', '已有页面按Ctrl+F5刷新一次。若浏览器没有弹出，可双击新增Windows_打开入口.bat，或复制终端里的网址。']) console.log(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installDesktopHotfix(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
