import { readFile, writeFile, mkdir, copyFile, rename, stat } from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = '// hengxiao-media-supplement:2026-10-20';
async function hash(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

export async function installMediaSupplement(root = projectRoot) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'fenghua-mainland') throw new Error('请选择原横小艺韵部署包中含 package.json 的项目目录。');
  const storagePath = path.join(root, 'runtime/storage.mjs');
  const original = await readFile(storagePath, 'utf8');
  const server = await readFile(path.join(root, 'runtime/server.mjs'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(root, 'src/media-supplement.json'), 'utf8'));
  if (manifest.frames?.length !== 91) throw new Error('补充清单不是91帧，请重新解压。');
  for (const [index, entry] of manifest.frames.entries()) {
    const expected = `/assets/crown-01-frame-${String(index + 1).padStart(3, '0')}.webp`;
    if (entry.path !== expected) throw new Error('凤冠图片顺序不正确。');
    const file = path.join(root, 'dist', entry.path);
    if ((await stat(file)).size !== entry.bytes || await hash(file) !== entry.sha256) {
      throw new Error(`图片缺失或损坏：${expected}`);
    }
  }
  await stat(path.join(root, 'runtime/media-supplement.mjs'));
  if (!/export\s+const\s+config\s*=/.test(original) || !server.includes("from './storage.mjs'")) {
    throw new Error('原包的服务结构与此补充包不匹配；已停止，未覆盖原服务或数据库。');
  }
  if (original.includes(marker)) {
    console.log('91帧素材校验通过，补充接口已经安装。');
    return;
  }
  const signature = /export\s+async\s+function\s+gallery\s*\(\s*\)/g;
  if ([...original.matchAll(signature)].length !== 1 || original.includes('galleryBeforeMediaSupplement')) {
    throw new Error('原包的展馆接口结构不匹配；已停止，未修改原接口。');
  }
  const patched = `import { supplementGallery } from './media-supplement.mjs';\n${original.replace(signature, 'async function galleryBeforeMediaSupplement()')}\n${marker}\nexport async function gallery(){return supplementGallery(await galleryBeforeMediaSupplement());}\n`;
  const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: patched, encoding: 'utf8' });
  if (checked.status !== 0) throw new Error('补充接口语法校验未通过，原文件未修改。');
  const backup = path.join(root, 'backups/media-supplement-20261020');
  await mkdir(backup, { recursive: true, mode: 0o700 });
  try { await copyFile(storagePath, path.join(backup, 'storage.mjs'), constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const temporary = storagePath + '.media-supplement-tmp';
  await writeFile(temporary, patched, { mode: (await stat(storagePath)).mode & 0o777 });
  await rename(temporary, storagePath);
  console.log('已接入第一组凤冠91帧，并预留第一部视频入口。原接口已备份；现有密码、留言及上传素材未改写。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installMediaSupplement().catch(error => { console.error(error.message); process.exitCode = 1; });
}
