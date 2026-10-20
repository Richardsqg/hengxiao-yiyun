import { readFile, writeFile, mkdir, copyFile, stat, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const marker = '// hengxiao-video-upload-fix:2026-10-20';
export function patchVideoStorage(source) {
  if (source.includes('validateVideoFile') && /validateVideoFile\(target\s*\+\s*['"]\.tmp['"]\)/.test(source)) return source;
  const renameCall = /await\s+rename\(target\s*\+\s*(['"])\.tmp\1,\s*target\);\s*(?=await\s+rm\(folder)/g;
  if ([...source.matchAll(renameCall)].length !== 1 || [...source.matchAll(/return\s*\{\s*key\s*\};/g)].length !== 1) throw new Error('原包的视频拼接接口结构不匹配，未修改。');
  source = source.replace(renameCall, `let media;try{media=await validateVideoFile(target+'.tmp');}catch(error){await rm(target+'.tmp',{force:true});throw error;}$&`);
  source = source.replace(/return\s*\{\s*key\s*\};/, 'return {key,media};');
  return `import { validateVideoFile } from './video-validation.mjs';\n${marker}\n${source}`;
}
export function patchVideoAdmin(source) {
  if (!source.includes('completed.media')) {
    const start = /if\s*\(\s*action\s*===\s*['"]video-complete['"]\s*\)/.exec(source);
    const end = /if\s*\(\s*action\s*===\s*['"]video-abort['"]\s*\)/.exec(source);
    if (!start || !end || start.index >= end.index) throw new Error('原包的视频发布接口结构不匹配，未修改。');
    const fragment = source.slice(start.index, end.index);
    const call = /await\s+bucket\(\)\.resumeMultipartUpload\(input\.key,\s*input\.uploadId\)\.complete\(input\.parts\);/;
    const save = /await\s+saveSetting\((['"])video-\1\s*\+\s*input\.slot,\s*value\);/;
    if (!call.test(fragment) || !save.test(fragment)) throw new Error('原包的视频发布接口结构不匹配，未修改。');
    const patched = fragment.replace(call, 'const completed=$&').replace(save, 'value.media=completed.media;$&')
      .replace(/return\s+json\(\{\s*ok:\s*true\s*\}\);/, 'return json({ok:true,media:completed.media});');
    source = source.slice(0, start.index) + patched + source.slice(end.index);
  }
  if (!/\.status\s*===\s*415/.test(source)) {
    const fallback = /catch\s*\{\s*return\s+json\(\{\s*error:\s*(['"])操作未完成，请检查网络后重试。\1\s*\},\s*503\);?\s*\}/;
    if (!fallback.test(source)) throw new Error('原包的上传错误接口结构不匹配，未修改。');
    source = source.replace(fallback, `catch(error){if(error?.status===415)return json({error:error.message,code:error.code},415);return json({error:'操作未完成，请检查网络后重试。'},503);}`);
  }
  return source;
}

export async function installVideoUploadFix(target, payload) {
  const root = path.resolve(target), source = path.resolve(payload);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'fenghua-mainland') throw new Error('请选择原横小艺韵部署包中含package.json、runtime、dist的目录。');
  const storagePath = path.join(root, 'runtime/storage.mjs'), adminPath = path.join(root, 'runtime/admin.mjs');
  const storage = await readFile(storagePath, 'utf8'), admin = await readFile(adminPath, 'utf8');
  const patchedStorage = patchVideoStorage(storage), patchedAdmin = patchVideoAdmin(admin);
  for (const code of [patchedStorage, patchedAdmin]) {
    if (spawnSync(process.execPath, ['--check', '--input-type=module'], { input: code }).status !== 0) throw new Error('接口语法验证失败，原文件未修改。');
  }
  const files = JSON.parse(await readFile(path.join(source, 'video-fix-manifest.json'), 'utf8'));
  for (const file of files) {
    if (!/^(runtime\/(mp4-inspect|video-validation)\.mjs|src\/mp4-inspect\.ts|web\/(Dashboard|Home|VideoPlayer)\.tsx|web\/video-preflight\.ts|scripts\/(repair-video|media-node|import-first-video)\.(mjs|sh)|dist\/index\.html|dist\/assets\/index-[a-zA-Z0-9_-]+\.(js|css)|docs\/VIDEO_UPLOAD_FIX_20261020\.md|macOS_另存兼容视频\.command|Windows_另存兼容视频\.bat)$/.test(file.path)) throw new Error('补充包出现非预期文件，已停止。');
    const bytes = await readFile(path.join(source, file.path));
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('补充包校验失败：' + file.path);
  }
  const backup = path.join(root, 'backups/video-upload-fix-20261020');
  async function preserve(relative) {
    const file = path.join(root, relative), saved = path.join(backup, relative);
    try { await stat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    await mkdir(path.dirname(saved), { recursive: true, mode: 0o700 });
    try { await copyFile(file, saved, constants.COPYFILE_EXCL); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  for (const relative of ['runtime/storage.mjs', 'runtime/admin.mjs', ...files.map(file => file.path)]) await preserve(relative);
  for (const file of files) {
    const destination = path.join(root, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, file.path), destination);
  }
  for (const [file, code] of [[storagePath, patchedStorage], [adminPath, patchedAdmin]]) {
    const temporary = file + '.video-fix-tmp';
    await writeFile(temporary, code, { mode: (await stat(file)).mode & 0o777 });
    await rename(temporary, file);
  }
  console.log('上传与播放器补充已安装。请使用原启动入口重启，再刷新后台页面。\n原密码、留言、已上传视频未改写；已备份被更新的程序文件。\n已有无画面的视频需另存为兼容版后重新上传，本补充不会假称原视频已自动转码。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installVideoUploadFix(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
