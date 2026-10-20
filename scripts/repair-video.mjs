import { access, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVideoFile } from '../runtime/video-validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function repairVideo(input, destination) {
  if (!input) throw new Error('请选择原视频文件。本工具会另存兼容版，不覆盖原片。');
  const source = path.resolve(input);
  if (!(await stat(source)).isFile()) throw new Error('所选内容不是文件。');
  const parsed = path.parse(source);
  const output = path.resolve(destination || path.join(parsed.dir, parsed.name + '-兼容版.mp4'));
  if (output === source) throw new Error('兼容版必须另存，不能覆盖原片。');
  try { await access(output); throw new Error('兼容版文件已存在，请选择其他输出文件名。'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const binary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [process.env.FFMPEG_PATH, path.join(root, 'tools', binary), binary].filter(Boolean);
  const ffmpeg = candidates.find(candidate => spawnSync(candidate, ['-version'], { stdio: 'ignore' }).status === 0);
  if (!ffmpeg) throw new Error('本机未找到FFmpeg，未转换原片。可将已有FFmpeg放到项目tools目录，或用视频工具导出H.264、8位4:2:0、AAC音频的MP4后重新上传。本补充不自动下载转码器。');
  const args = ['-nostdin', '-hide_banner', '-n', '-i', source, '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1', '-preset', 'medium', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', '-sn', '-dn', output];
  console.log('正在另存H.264/AAC兼容版，原视频保持不变。视频越长，所需时间越久。');
  const child = spawn(ffmpeg, args, { stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw new Error('转换未完成，原片仍保留。请勿上传未完成的输出文件。');
  const media = await validateVideoFile(output);
  console.log(`兼容版已另存：${output}\nH.264 ${media.video.width}×${media.video.height}，${media.audio ? 'AAC-LC音频' : '静音'}。请在后台选此文件、播放确认后上传替换。`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  repairVideo(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
