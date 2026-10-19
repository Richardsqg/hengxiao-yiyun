import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, stat, rename, rm, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'work', 'video-export');
const maximumBytes = 30 * 1024 * 1024;
const installationHelp = '请安装 FFmpeg（需要同时包含 ffmpeg 和 ffprobe），把其 bin 文件夹加入系统 PATH，然后重新打开终端。下载说明：https://ffmpeg.org/download.html';
let currentChild;

function run(program, args, showProgress = false) {
  return new Promise((resolve, reject) => {
    // 参数直接传给程序，不经过命令行 shell，支持中文、空格及特殊字符路径。
    const child = spawn(program, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    currentChild = child;
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-16000);
      if (showProgress) process.stderr.write(chunk);
    });
    child.once('error', error => {
      if (currentChild === child) currentChild = undefined;
      reject(new Error(error.code === 'ENOENT' ? `找不到 ${program}。${installationHelp}` : `${program} 无法运行：${error.message}`));
    });
    child.once('close', code => {
      if (currentChild === child) currentChild = undefined;
      if (code === 0) resolve(stdout);
      else reject(new Error(`${program} 处理失败（退出码 ${code}）。${stderr.trim()}`));
    });
  });
}

async function probe(file) {
  return JSON.parse(await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
}

function videoDetails(info) {
  const video = info.streams.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  const duration = Number(info.format?.duration || video?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0 || !(video.width > 0 && video.height > 0)) {
    throw new Error('无法读取有效的视频画面或时长，请确认源文件可以正常播放。');
  }
  const sar = (video.sample_aspect_ratio || '1:1').split(':').map(Number);
  const pixelRatio = sar[0] > 0 && sar[1] > 0 ? sar[0] / sar[1] : 1;
  let width = video.width * pixelRatio, height = video.height;
  const rotation = Number(video.side_data_list?.find(item => Number.isFinite(Number(item.rotation)))?.rotation || video.tags?.rotate || 0);
  if (Math.abs(rotation % 180) === 90) [width, height] = [height, width];
  const rate = (video.avg_frame_rate || '0/1').split('/').map(Number);
  const fps = rate[1] ? rate[0] / rate[1] : 0;
  return { video, duration, width, height, fps, audio: info.streams.filter(stream => stream.codec_type === 'audio') };
}

function encodingPlan(details, videoBitrate) {
  const bounds = videoBitrate >= 2800000 ? [1920, 1080] : videoBitrate >= 1500000 ? [1280, 720] : videoBitrate >= 700000 ? [960, 540] : videoBitrate >= 350000 ? [854, 480] : [640, 360];
  if (details.width < details.height) bounds.reverse();
  const scale = Math.min(1, bounds[0] / details.width, bounds[1] / details.height);
  const width = Math.max(2, Math.floor(details.width * scale / 2) * 2);
  const height = Math.max(2, Math.floor(details.height * scale / 2) * 2);
  // FFmpeg 默认按旋转信息摆正画面；方形像素和偶数边长便于浏览器播放。
  const filter = `scale=${width}:${height}:flags=lanczos,setsar=1` + (details.fps > 30 ? ',fps=30' : '');
  return { width, height, filter };
}

function destinationFor(file) {
  const stem = path.basename(file, path.extname(file)).slice(0, 80);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  return path.join(outputDirectory, `${stem}-30MiB以内-${stamp}-${randomUUID().slice(0, 8)}.mp4`);
}

async function inputPath() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg === '--help' || arg === '-h')) {
    console.log('用法：node scripts/compress-video.mjs "原视频的完整路径.mp4"\n也可把视频拖到 Windows_压缩视频.bat 上，或双击该文件后输入路径。\n输出：work/video-export/，H.264 + AAC，最大 30 MiB；原视频保持不变。\n已符合大小和格式要求的 MP4 直接复制，其他视频使用双遍编码。');
    return null;
  }
  if (args.length > 1) throw new Error('每次请只选择一部视频；含空格的路径请用英文双引号括起来。');
  let input = args[0];
  if (!input) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { input = await rl.question('请输入或拖入原视频的完整路径，然后按回车：'); }
    finally { rl.close(); }
  }
  input = input.trim().replace(/^"(.*)"$/, '$1');
  if (!input) throw new Error('没有选择视频。');
  const file = path.resolve(input);
  let source;
  try { source = await stat(file); } catch { throw new Error('找不到源视频，请检查完整路径：' + file); }
  if (!source.isFile()) throw new Error('请选择视频文件，不要选择文件夹。');
  return { file, source };
}

async function main() {
  const input = await inputPath();
  if (!input) return;
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  const info = await probe(input.file);
  const details = videoDetails(info);
  await mkdir(outputDirectory, { recursive: true });
  console.log(`源视频：${input.file}\n时长：${details.duration.toFixed(1)} 秒；原大小：${(input.source.size / 1024 ** 2).toFixed(2)} MiB；音轨：${details.audio.length} 条。`);
  if (input.source.size <= maximumBytes && info.format?.format_name?.split(',').includes('mp4') && details.video.codec_name === 'h264' && details.video.pix_fmt === 'yuv420p' && details.audio.every(stream => stream.codec_name === 'aac')) {
    const destination = destinationFor(input.file);
    await copyFile(input.file, destination, constants.COPYFILE_EXCL);
    try {
      const result = await stat(destination);
      const verified = videoDetails(await probe(destination));
      if (result.size !== input.source.size || result.size > maximumBytes || verified.duration !== details.duration || verified.audio.length !== details.audio.length) throw new Error('复制校验未通过，请确认处理期间源视频没有被其他程序修改。');
      console.log(`\n源文件已符合大小和格式要求，已原样复制并校验，未重新编码：${destination}\n实际大小：${(result.size / 1024 ** 2).toFixed(2)} MiB（${result.size} 字节，不超过 30 MiB）。\n请先播放检查，再将此文件上传到聊天。原视频未修改。`);
      return;
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }
  }
  // 预留 6% 容器与码率波动余量；编码后仍须验证真实文件大小。
  const totalBitrate = Math.floor(maximumBytes * 8 * 0.94 / details.duration);
  const audioRates = details.audio.map(stream => {
    const preferred = stream.channels > 2 ? 192000 : stream.channels === 1 ? 64000 : 96000;
    return Math.max(32000, Math.min(preferred, Math.floor(totalBitrate * 0.3 / details.audio.length / 1000) * 1000));
  });
  let videoBitrate = totalBitrate - audioRates.reduce((total, bitrate) => total + bitrate, 0) - 8000;
  if (videoBitrate < 64000) throw new Error('这部视频过长，30 MiB 内无法保留全部音轨和可用画质。请先剪辑或拆成较短的视频后重试。');
  const sourceVideoBitrate = Number(details.video.bit_rate);
  if (Number.isFinite(sourceVideoBitrate) && sourceVideoBitrate > 0) {
    videoBitrate = Math.min(videoBitrate, Math.max(64000, Math.floor(sourceVideoBitrate * 0.9)));
  }
  const temporaryDirectory = await mkdtemp(path.join(outputDirectory, '.encoding-'));
  const temporaryVideo = path.join(temporaryDirectory, 'compressed.mp4');
  console.log('正在本机压缩，请保持窗口开启。此操作不会上传文件或更改展馆当前视频。');
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const plan = encodingPlan(details, videoBitrate);
      const passLog = path.join(temporaryDirectory, 'pass-' + attempt);
      const common = ['-hide_banner', '-loglevel', 'warning', '-stats', '-nostdin', '-y', '-i', input.file, '-map', `0:${details.video.index}`, '-vf', plan.filter, '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-b:v', String(videoBitrate), '-passlogfile', passLog, '-sn', '-dn'];
      console.log(`第 ${attempt} 轮：${plan.width} × ${plan.height}，视频码率约 ${Math.round(videoBitrate / 1000)} kbps。第一遍分析…`);
      await run('ffmpeg', [...common, '-pass', '1', '-an', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], true);
      const audioArgs = details.audio.length ? ['-map', '0:a', '-c:a', 'aac', ...audioRates.flatMap((bitrate, index) => [`-b:a:${index}`, String(bitrate)])] : ['-an'];
      console.log('第二遍生成 MP4…');
      await run('ffmpeg', [...common, '-pass', '2', ...audioArgs, '-map_metadata', '-1', '-map_chapters', '-1', '-metadata:s:v:0', 'rotate=0', '-movflags', '+faststart', temporaryVideo], true);
      const result = await stat(temporaryVideo);
      if (result.size > maximumBytes) {
        videoBitrate = Math.floor(videoBitrate * maximumBytes / result.size * 0.9);
        console.log(`实际大小 ${(result.size / 1024 ** 2).toFixed(2)} MiB，超过 30 MiB，将降低码率重试。`);
        if (videoBitrate < 64000) break;
        continue;
      }
      const verified = videoDetails(await probe(temporaryVideo));
      if (!result.size || verified.video.codec_name !== 'h264' || verified.audio.some(stream => stream.codec_name !== 'aac') || verified.audio.length !== details.audio.length || Math.abs(verified.duration - details.duration) > Math.max(2, details.duration * 0.02)) {
        throw new Error('输出的视频格式、音轨或时长校验未通过，没有交付该结果。');
      }
      const destination = destinationFor(input.file);
      await rename(temporaryVideo, destination);
      console.log(`\n压缩完成并已校验：${destination}\n实际大小：${(result.size / 1024 ** 2).toFixed(2)} MiB（${result.size} 字节，不超过 30 MiB）。\n保留 ${verified.audio.length} 条音轨。请先播放检查，再将此文件上传到聊天。原视频未修改。`);
      return;
    }
    throw new Error('经过三轮压缩仍未得到符合 30 MiB 限制的结果，请先剪辑或拆成较短的视频后重试。');
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

process.once('SIGINT', () => { currentChild?.kill('SIGINT'); });
main().catch(error => { console.error('\n压缩未完成：' + error.message); process.exitCode = 1; });
