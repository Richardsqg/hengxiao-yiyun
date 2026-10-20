import { inspectMp4, type Mp4Inspection } from '../src/mp4-inspect';

export const MAX_VIDEO_BYTES = 400 * 1024 * 1024;
export const VIDEO_ENCODING_HELP = '请导出为 H.264（8位、4:2:0）视频和 AAC 音频的 MP4，再重新选择。不要仅修改文件后缀。';

// Blob.slice keeps a large upload out of a single JavaScript ArrayBuffer.
export async function preflightVideo(file: File): Promise<Mp4Inspection> {
  if (!/\.mp4$/i.test(file.name) || !file.size || file.size > MAX_VIDEO_BYTES) {
    throw new Error('请选择400MB以内的 MP4 视频。');
  }
  const media = await inspectMp4(async (offset, length) => {
    return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
  }, file.size);
  const probe = document.createElement('video');
  const codecs = [media.video.codecString, media.audio?.codecString].filter(Boolean).join(', ');
  if (!probe.canPlayType(`video/mp4; codecs="${codecs}"`)) {
    throw new Error(`当前浏览器不支持这部影片的编码，尚未上传或替换原影片。${VIDEO_ENCODING_HELP}`);
  }
  return media;
}
