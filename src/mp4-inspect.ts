export type Mp4Read = (offset: number, length: number) => Promise<Uint8Array>;
export interface Mp4Inspection {
  container: 'mp4';
  video: { codec: 'avc1' | 'avc3'; codecString: string; profile: 'Baseline' | 'Main' | 'High'; profileIdc: number; levelIdc: number; width: number; height: number; bitDepth: 8; chromaFormat: '4:2:0' };
  audio: null | { codec: 'mp4a'; codecString: 'mp4a.40.2'; profile: 'AAC-LC'; sampleRate: number; channels: number };
}
const advice = '请导出为MP4：H.264（8位、4:2:0，Baseline/Main/High）视频，以及可选的AAC-LC音频后重试。';
export class Mp4ValidationError extends Error {
  readonly status = 415;
  readonly code: string;
  constructor(reason: string, code = 'MP4_INVALID') { super(`${reason} ${advice}`); this.name = 'Mp4ValidationError'; this.code = code; }
}
type Box = { start: number; payload: number; end: number; type: string };
const fail = (reason: string, code?: string): never => { throw new Mp4ValidationError(reason, code); };
const u16 = (b: Uint8Array, p = 0) => (b[p] << 8) | b[p + 1];
const u32 = (b: Uint8Array, p = 0) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p);
const text = (b: Uint8Array, p = 0, n = b.length - p) => String.fromCharCode(...b.subarray(p, p + n));
class Bits {
  position = 0;
  constructor(readonly bytes: Uint8Array) {}
  get remaining() { return this.bytes.length * 8 - this.position; }
  take(count: number): number {
    if (count < 0 || count > 32 || this.remaining < count) fail('视频或音频编码配置不完整。');
    let value = 0;
    for (let i = 0; i < count; i++) { value = value * 2 + ((this.bytes[this.position >> 3] >> (7 - (this.position & 7))) & 1); this.position++; }
    return value;
  }
  ue(): number { let zeros = 0; while (this.take(1) === 0) if (++zeros > 24) fail('视频编码配置不正确。'); return (2 ** zeros - 1) + this.take(zeros); }
}
function spsFormat(nal: Uint8Array, profile: number, level: number) {
  if (nal.length < 5 || (nal[0] & 31) !== 7 || nal[1] !== profile || nal[3] !== level) fail('H.264视频配置不完整。');
  const bytes: number[] = [];
  for (let i = 1; i < nal.length; i++) { if (i >= 3 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue; bytes.push(nal[i]); }
  const bits = new Bits(Uint8Array.from(bytes));
  bits.take(24); bits.ue();
  if (profile === 100) {
    const chroma = bits.ue(); if (chroma === 3) bits.take(1);
    const depthY = bits.ue(), depthC = bits.ue();
    if (chroma !== 1 || depthY !== 0 || depthC !== 0) fail('该视频不是8位4:2:0色彩格式。', 'MP4_VIDEO_FORMAT');
  }
}
function avcConfig(bytes: Uint8Array, codec: 'avc1' | 'avc3') {
  if (bytes.length < 7 || bytes[0] !== 1) fail('缺少有效的H.264解码配置。');
  const profile = bytes[1], level = bytes[3];
  const profiles = { 66: 'Baseline', 77: 'Main', 100: 'High' } as const;
  if (!(profile in profiles)) fail(`该H.264视频使用不兼容的Profile ${profile}，可能为10位或高色深格式。`, 'MP4_VIDEO_PROFILE');
  if ((bytes[4] & 3) === 2 || !level) fail('H.264视频配置不正确。');
  let offset = 6;
  const spsCount = bytes[5] & 31;
  if (!spsCount) fail('视频缺少H.264图像参数。');
  for (let i = 0; i < spsCount; i++) {
    if (offset + 2 > bytes.length) fail('H.264参数被截断。');
    const size = u16(bytes, offset); offset += 2;
    if (size < 5 || offset + size > bytes.length) fail('H.264参数被截断。');
    spsFormat(bytes.subarray(offset, offset + size), profile, level); offset += size;
  }
  if (offset >= bytes.length) fail('视频缺少H.264图像参数。');
  const ppsCount = bytes[offset++]; if (!ppsCount) fail('视频缺少H.264图像参数。');
  for (let i = 0; i < ppsCount; i++) {
    if (offset + 2 > bytes.length) fail('H.264参数被截断。');
    const size = u16(bytes, offset); offset += 2;
    if (size < 2 || offset + size > bytes.length || (bytes[offset] & 31) !== 8) fail('H.264参数不正确。');
    offset += size;
  }
  if (profile === 100 && offset < bytes.length) {
    if (bytes.length - offset < 4) fail('H.264高规格配置被截断。');
    if ((bytes[offset] & 3) !== 1 || (bytes[offset + 1] & 7) || (bytes[offset + 2] & 7)) fail('视频不是8位4:2:0色彩格式。', 'MP4_VIDEO_FORMAT');
  }
  const hex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
  return { codec, codecString: `${codec}.${hex(profile)}${hex(bytes[2])}${hex(level)}`, profile: profiles[profile as keyof typeof profiles], profileIdc: profile, levelIdc: level, bitDepth: 8 as const, chromaFormat: '4:2:0' as const };
}
function audioConfig(bytes: Uint8Array) {
  if (bytes.length < 2) fail('AAC音频配置不完整。');
  const bits = new Bits(bytes);
  let object = bits.take(5); if (object === 31) object = 32 + bits.take(6);
  if (object !== 2) fail('音频不是兼容的AAC-LC编码。', 'MP4_AUDIO_CODEC');
  const frequencies = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const index = bits.take(4), sampleRate = index === 15 ? bits.take(24) : frequencies[index];
  const channelConfig = bits.take(4);
  if (!sampleRate || sampleRate < 7350 || sampleRate > 96000 || channelConfig < 1 || channelConfig > 7) fail('AAC音频采样率或声道配置无法确认。', 'MP4_AUDIO_CODEC');
  if (bits.take(1) || bits.take(1) || bits.take(1)) fail('该AAC音频使用不兼容的扩展配置。', 'MP4_AUDIO_CODEC');
  if (bits.remaining >= 16) {
    const sync = bits.take(11);
    if (sync === 0x2b7 && bits.take(5) === 5 && bits.remaining && bits.take(1)) fail('该音频带有HE-AAC扩展，请使用AAC-LC。', 'MP4_AUDIO_CODEC');
  }
  return { codec: 'mp4a' as const, codecString: 'mp4a.40.2' as const, profile: 'AAC-LC' as const, sampleRate, channels: channelConfig === 7 ? 8 : channelConfig };
}
function esdsConfig(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0) fail('音频解码配置不完整。');
  let count = 0;
  function scan(start: number, end: number, depth: number, decoder = false): Uint8Array | null {
    if (depth > 4) fail('音频配置嵌套过深。');
    let offset = start;
    while (offset < end) {
      if (++count > 128 || offset + 2 > end) fail('音频配置结构不正确。');
      const tag = bytes[offset++]; let size = 0, finished = false;
      for (let n = 0; n < 4; n++) { if (offset >= end) fail('音频配置被截断。'); const value = bytes[offset++]; size = size * 128 + (value & 127); if (!(value & 128)) { finished = true; break; } }
      const payload = offset, limit = payload + size;
      if (!finished || !size || limit > end) fail('音频配置长度不正确。');
      let nested: Uint8Array | null = null;
      if (tag === 3) {
        if (size < 3) fail('音频描述不完整。');
        const flags = bytes[payload + 2]; let inner = payload + 3;
        if (flags & 0x80) inner += 2;
        if (flags & 0x40) { if (inner >= limit) fail('音频配置被截断。'); inner += 1 + bytes[inner]; }
        if (flags & 0x20) inner += 2;
        if (inner > limit) fail('音频配置被截断。');
        nested = scan(inner, limit, depth + 1);
      } else if (tag === 4) {
        if (size < 13 || bytes[payload] !== 0x40 || (bytes[payload + 1] >> 2) !== 5) fail('音频不是MPEG-4 AAC-LC编码。', 'MP4_AUDIO_CODEC');
        nested = scan(payload + 13, limit, depth + 1, true);
      } else if (tag === 5 && decoder) return bytes.subarray(payload, limit);
      if (nested) return nested;
      offset = limit;
    }
    return null;
  }
  const specific = scan(4, bytes.length, 0);
  if (!specific) fail('找不到AAC-LC音频配置。', 'MP4_AUDIO_CODEC');
  return audioConfig(specific);
}

export async function inspectMp4(read: Mp4Read, size: number): Promise<Mp4Inspection> {
  if (!Number.isSafeInteger(size) || size < 24) fail('视频文件不完整。');
  let boxCount = 0, readBytes = 0;
  async function exact(offset: number, length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > 256 * 1024 || offset + length > size || (readBytes += length) > 2 * 1024 * 1024) fail('视频元数据过大或结构不正确。');
    const bytes = await read(offset, length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== length) fail('视频文件被截断，无法读取完整配置。');
    return bytes;
  }
  async function boxes(start: number, end: number, depth = 0): Promise<Box[]> {
    if (depth > 8) fail('视频容器嵌套过深。');
    const result: Box[] = [];
    for (let offset = start; offset < end;) {
      if (++boxCount > 4096 || end - offset < 8) fail('视频容器结构不正确。');
      const bytes = await exact(offset, 8), type = text(bytes, 4, 4);
      let length = u32(bytes), header = 8;
      if (length === 1) {
        if (end - offset < 16) fail('视频容器长度被截断。');
        const extended = await exact(offset + 8, 8);
        const big = new DataView(extended.buffer, extended.byteOffset, 8).getBigUint64(0);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) fail('视频容器长度不正确。');
        length = Number(big); header = 16;
      } else if (length === 0) length = end - offset;
      if (length < header || length > end - offset) fail('视频容器长度不正确或文件被截断。');
      result.push({ start: offset, payload: offset + header, end: offset + length, type });
      offset += length;
    }
    return result;
  }
  function one(list: Box[], type: string): Box {
    const matches = list.filter(box => box.type === type);
    if (matches.length !== 1) fail('视频缺少必要的媒体配置，或配置重复。');
    return matches[0];
  }
  const top = await boxes(0, size);
  const ftyp = one(top, 'ftyp'), moov = one(top, 'moov');
  if (ftyp.end - ftyp.payload < 8 || (ftyp.end - ftyp.payload) % 4) fail('不是完整的MP4容器。');
  if (!top.some(box => box.type === 'mdat' && box.end > box.payload)) fail('视频文件没有媒体数据。');
  const tracks = (await boxes(moov.payload, moov.end, 1)).filter(box => box.type === 'trak');
  if (!tracks.length || tracks.length > 16) fail('视频轨道数量不正确。');
  const videos: Mp4Inspection['video'][] = [], audios: NonNullable<Mp4Inspection['audio']>[] = [];
  for (const track of tracks) {
    const mdia = one(await boxes(track.payload, track.end, 2), 'mdia');
    const media = await boxes(mdia.payload, mdia.end, 3);
    const handler = one(media, 'hdlr');
    if (handler.end - handler.payload < 12) fail('视频轨道描述不完整。');
    const kind = text(await exact(handler.payload + 8, 4));
    if (kind !== 'vide' && kind !== 'soun') continue;
    const minf = one(media, 'minf');
    const stbl = one(await boxes(minf.payload, minf.end, 4), 'stbl');
    const stsd = one(await boxes(stbl.payload, stbl.end, 5), 'stsd');
    if (stsd.end - stsd.payload < 8) fail('视频编码描述不完整。');
    const description = await exact(stsd.payload, 8);
    if (description[0] !== 0) fail('视频编码描述版本不支持。');
    const entries = await boxes(stsd.payload + 8, stsd.end, 6);
    if (!entries.length || entries.length > 16 || entries.length !== u32(description, 4)) fail('视频编码描述数量不正确。');
    for (const entry of entries) {
      if (kind === 'vide') {
        if (entry.type !== 'avc1' && entry.type !== 'avc3') {
          const codec = ({ hvc1: 'HEVC/H.265', hev1: 'HEVC/H.265', av01: 'AV1', vp09: 'VP9', mp4v: 'MPEG-4 Part 2', encv: '加密视频' } as Record<string, string>)[entry.type] || '未知视频编码';
          fail(`该MP4使用${codec}，不能保证Windows、Mac和手机都有画面。`, 'MP4_VIDEO_CODEC');
        }
        if (entry.end - entry.payload < 78) fail('视频画幅配置不完整。');
        const dimensions = await exact(entry.payload + 24, 4), width = u16(dimensions), height = u16(dimensions, 2);
        if (width < 16 || height < 16 || width > 8192 || height > 8192) fail('视频画幅配置不正确，请导出常规720p或1080p画幅。', 'MP4_DIMENSIONS');
        const config = one(await boxes(entry.payload + 78, entry.end, 7), 'avcC');
        const video = avcConfig(await exact(config.payload, config.end - config.payload), entry.type);
        videos.push({ ...video, width, height });
      } else {
        if (entry.type !== 'mp4a') fail('音频编码不是AAC-LC。', 'MP4_AUDIO_CODEC');
        if (entry.end - entry.payload < 28) fail('音频轨道描述不完整。');
        const fields = await exact(entry.payload, 28);
        if (u16(fields, 8) !== 0) fail('音频轨道不是标准MP4格式，请重新导出。', 'MP4_AUDIO_CODEC');
        const config = one(await boxes(entry.payload + 28, entry.end, 7), 'esds');
        audios.push(esdsConfig(await exact(config.payload, config.end - config.payload)));
      }
    }
  }
  if (!videos.length) fail('此文件没有可播放的视频画面轨道，可能只有声音。', 'MP4_NO_VIDEO');
  return { container: 'mp4', video: videos[0], audio: audios[0] || null };
}
