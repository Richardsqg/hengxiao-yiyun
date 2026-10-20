import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectMp4 } from '../runtime/mp4-inspect.mjs';
const fixture = name => readFile(new URL('./fixtures/' + name, import.meta.url));
const inspect = bytes => inspectMp4(async (offset, length) => bytes.subarray(offset, offset + length), bytes.length);

test('real H264/AAC file exposes compatible picture and audio configuration', async () => {
  const media = await inspect(await fixture('h264-aac.mp4'));
  assert.equal(media.video.width, 160); assert.equal(media.video.height, 120);
  assert.equal(media.video.bitDepth, 8); assert.equal(media.video.chromaFormat, '4:2:0');
  assert.equal(media.audio.codecString, 'mp4a.40.2');
});
test('real audio-only and HEVC files produce specific compatibility errors', async () => {
  for (const [name, code] of [['audio-only.mp4', 'MP4_NO_VIDEO'], ['hevc-aac.mp4', 'MP4_VIDEO_CODEC']]) {
    await assert.rejects(inspect(await fixture(name)), error => error.status === 415 && error.code === code && error.message.includes('H.264'));
  }
});
test('declared High 10 profile is rejected rather than assumed to be standard H264', async () => {
  const bytes = await fixture('h264-aac.mp4'), config = bytes.indexOf('avcC'); assert.ok(config > 0);
  bytes[config + 5] = 110;
  await assert.rejects(inspect(bytes), error => error.code === 'MP4_VIDEO_PROFILE');
});
test('64-bit boxes are bounded and impossible lengths or short reads are rejected', async () => {
  const bytes = await fixture('h264-aac.mp4'), extended = Buffer.alloc(20);
  extended.writeUInt32BE(1); extended.write('free', 4); extended.writeBigUInt64BE(20n, 8);
  assert.equal((await inspect(Buffer.concat([bytes, extended]))).video.codec, 'avc1');
  extended.writeBigUInt64BE(0xffffffffffffffffn, 8);
  await assert.rejects(inspect(Buffer.concat([bytes, extended])), error => error.status === 415);
  await assert.rejects(inspectMp4(async () => new Uint8Array(0), 100), error => error.status === 415);
});
test('151 MiB container inspection seeks over media/padding without reading its payload', async () => {
  const bytes = await fixture('h264-aac.mp4'), size = 151 * 1024 * 1024, header = Buffer.alloc(8);
  header.writeUInt32BE(size - bytes.length); header.write('free', 4);
  const prefix = Buffer.concat([bytes, header]); let readBytes = 0;
  const media = await inspectMp4(async (offset, length) => { readBytes += length; assert.ok(offset + length <= prefix.length); return prefix.subarray(offset, offset + length); }, size);
  assert.equal(media.video.codec, 'avc1'); assert.ok(readBytes < 16384);
});
