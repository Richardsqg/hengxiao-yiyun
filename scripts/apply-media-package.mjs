import { readFile, mkdir, copyFile, chmod, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export async function applyMediaPackage(target, payload) {
  const root = path.resolve(target);
  const source = path.resolve(payload);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const storage = await readFile(path.join(root, 'runtime/storage.mjs'), 'utf8');
  const server = await readFile(path.join(root, 'runtime/server.mjs'), 'utf8');
  if (pkg.name !== 'fenghua-mainland' || !/export\s+const\s+config\s*=/.test(storage)
      || !server.includes("from './storage.mjs'")
      || (!storage.includes('// hengxiao-media-supplement:2026-10-20') && !/export\s+async\s+function\s+gallery\s*\(\s*\)/.test(storage))) {
    throw new Error('所选目录与补充包结构不匹配，已停止。请选择原包中含 package.json、runtime、dist 的项目目录。');
  }
  const files = JSON.parse(await readFile(path.join(source, 'package-manifest.json'), 'utf8'));
  for (const entry of files) {
    if (!/^(scripts\/[a-z-]+\.(mjs|sh|bat)|runtime\/media-supplement\.mjs|src\/media-supplement\.json|docs\/(MEDIA_SUPPLEMENT_20261020\.md|WINDOWS_CROWN360_20261021\.md|DESKTOP_ADDONS_GUIDE_20261021\.(html|txt))|macOS_[^/]+\.command|Windows_[^/]+\.bat|dist\/assets\/crown-01-frame-\d{3}\.webp)$/.test(entry.path)) throw new Error('补充清单含非预期路径，已停止。');
    const bytes = await readFile(path.join(source, entry.path));
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('补充包校验失败：' + entry.path);
  }
  for (const entry of files) {
    const destination = path.join(root, entry.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, entry.path), destination);
    if (entry.path.endsWith('.command') || entry.path.endsWith('.sh')) await chmod(destination, 0o755);
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'src/media-supplement.json'), 'utf8'));
  let needsFrames = false;
  for (const frame of manifest.frames) {
    try { await access(path.join(root, 'dist', frame.path)); }
    catch { needsFrames = true; break; }
  }
  if (!needsFrames) {
    const { installMediaSupplement } = await import(pathToFileURL(path.join(root, 'scripts/install-media-supplement.mjs')).href);
    await installMediaSupplement(root);
  }
  console.log('补充文件已逐个加入原项目。未替换整个目录、未重新安装依赖。');
  return { needsFrames };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) { console.error('需要原项目目录和补充包payload目录。'); process.exitCode = 1; }
  else applyMediaPackage(process.argv[2], process.argv[3]).then(result => { if (result.needsFrames) process.exitCode = 10; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
