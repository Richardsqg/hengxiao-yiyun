import { stat, open, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVideoFile } from '../runtime/video-validation.mjs';

export async function importFirstVideo(source, root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  if (!source) throw new Error('请选择从「掐丝珐琅.zip」解压出的 MP4 视频；不要选择 ZIP 本身。');
  const input = path.resolve(source);
  const destination = path.join(root, 'dist/assets/film-01-qiasi.mp4');
  if (!/\.(mp4|m4v)$/i.test(input)) throw new Error('请选择 MP4 视频。MOV/ZIP 不能直接改后缀；MOV 需要先导出为 H.264/AAC 的 MP4。');
  if (!(await stat(input)).isFile()) throw new Error('所选内容不是视频文件。');
  const handle = await open(input, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 12 || header.toString('ascii', 4, 8) !== 'ftyp') throw new Error('文件不是可识别的 MP4 容器，请勿只修改文件后缀。');
  } finally { await handle.close(); }
  await validateVideoFile(input);
  if (input !== destination) {
    try { await copyFile(input, destination, constants.COPYFILE_EXCL); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('目标视频已存在。若要更换，请先自行保留旧版，再将新视频放到 dist/assets/film-01-qiasi.mp4。');
      throw error;
    }
  }
  console.log('第一部视频已放好：dist/assets/film-01-qiasi.mp4。请关闭旧启动窗口，再用本次 Mac 启动入口打开。');
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importFirstVideo(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
