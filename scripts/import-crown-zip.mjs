import { readFile, writeFile, stat, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMediaSupplement } from './install-media-supplement.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function importCrownZip(archive, project = root) {
  if (!archive || !/\.zip$/i.test(archive)) throw new Error('请选择原来的「凤冠360_网页轻量包_91帧.zip」。');
  const zip = path.resolve(archive);
  if (!(await stat(zip)).isFile()) throw new Error('所选内容不是ZIP文件。');
  const manifest = JSON.parse(await readFile(path.join(project, 'src/media-supplement.json'), 'utf8'));
  const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
  // Read exact entries to stdout; never execute or extract attachment instructions/paths.
  for (const [index, entry] of manifest.frames.entries()) {
    const name = `frames/frame_${String(index + 1).padStart(3, '0')}.webp`;
    const expected = `/assets/crown-01-frame-${String(index + 1).padStart(3, '0')}.webp`;
    if (entry.path !== expected) throw new Error('补充清单顺序不正确。');
    const result = spawnSync('/usr/bin/unzip', ['-p', zip, name], { maxBuffer: 4 * 1024 * 1024 });
    if (result.status !== 0 || result.stdout.length !== entry.bytes || checksum(result.stdout) !== entry.sha256) {
      throw new Error(`原ZIP缺少或损坏第${index + 1}帧，请选择这次提供的91帧轻量包。`);
    }
    const destination = path.join(project, 'dist', entry.path);
    let existing;
    try { existing = await readFile(destination); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) {
      if (checksum(existing) !== entry.sha256) throw new Error(`目标图片已有不同内容，已保留未覆盖：${entry.path}`);
      continue;
    }
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = destination + '.media-importing';
    await writeFile(temporary, result.stdout, { flag: 'wx', mode: 0o644 });
    await rename(temporary, destination);
  }
  await installMediaSupplement(project);
  console.log('第一组91帧凤冠已全部导入。可双击本机或同Wi-Fi扫码启动入口。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importCrownZip(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
