import { readFile, writeFile, stat, mkdir, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMediaSupplement } from './install-media-supplement.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function importCrownFolder(input, project = root) {
  if (!input) throw new Error('请先解压凤冠91帧ZIP，再选择含frames文件夹的目录，或直接选择frames文件夹。');
  const source = path.resolve(input);
  if (!(await stat(source)).isDirectory()) throw new Error('请选择解压后的图片文件夹，不要选择ZIP文件。');
  let framesFolder;
  for (const candidate of [path.join(source, 'frames'), source]) {
    try { if ((await stat(path.join(candidate, 'frame_001.webp'))).isFile()) { framesFolder = candidate; break; } }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!framesFolder) throw new Error('没有找到frame_001.webp。请找到解压后含91张WebP的frames文件夹。');
  const manifest = JSON.parse(await readFile(path.join(project, 'src/media-supplement.json'), 'utf8'));
  if (manifest.frames?.length !== 91) throw new Error('项目内的补充清单不完整，请重新安装本次小补充包。');
  const entries = [];
  // Check all original frames before adding any image to the project.
  for (const [index, entry] of manifest.frames.entries()) {
    const expected = `/assets/crown-01-frame-${String(index + 1).padStart(3, '0')}.webp`;
    if (entry.path !== expected) throw new Error('凤冠图片清单顺序不正确。');
    const file = path.join(framesFolder, `frame_${String(index + 1).padStart(3, '0')}.webp`);
    const info = await stat(file);
    if (!info.isFile() || info.size !== entry.bytes || digest(await readFile(file)) !== entry.sha256) {
      throw new Error(`第${index + 1}帧与原91帧轻量包不一致，尚未添加图片。请重新解压原ZIP。`);
    }
    const destination = path.join(project, 'dist', entry.path);
    try {
      const existing = await stat(destination);
      if (!existing.isFile() || existing.size !== entry.bytes || digest(await readFile(destination)) !== entry.sha256) {
        throw new Error(`目标图片已有不同内容，已保留未覆盖：${entry.path}`);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    entries.push({ ...entry, file, destination });
  }
  for (const entry of entries) {
    try { await stat(entry.destination); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const bytes = await readFile(entry.file);
    if (digest(bytes) !== entry.sha256) throw new Error('导入期间原图片发生变化，请重新选择完整素材。');
    await mkdir(path.dirname(entry.destination), { recursive: true });
    const temporary = entry.destination + '.media-import-' + randomUUID();
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
    await rename(temporary, entry.destination);
  }
  await installMediaSupplement(project);
  console.log('第一组91帧凤冠已全部导入并校验。请使用原Windows启动入口重新运行展馆。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importCrownFolder(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
