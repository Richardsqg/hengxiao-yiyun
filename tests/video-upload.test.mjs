import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, open, stat, rm, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let folder, origin, child, cookie, published;
const digest = async file => { const h = createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); };
const request = (url, options = {}) => fetch(origin + url, { ...options, headers: { Origin: origin, Cookie: cookie || '', ...options.headers } });
const post = (action, value) => request('/api/admin?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
before(async () => {
  await mkdir(path.join(root, 'work'), { recursive: true });
  folder = await mkdtemp(path.join(root, 'work/video-upload-test-'));
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); origin = `http://127.0.0.1:${port}`;
  const password = 'Video-upload-test-only-8326';
  await writeFile(path.join(folder, 'config.json'), JSON.stringify({ origin, password: { salt: 'test-only', hash: scryptSync(password, 'test-only', 32).toString('hex') }, feedbackSalt: 'test-only' }));
  child = spawn(process.execPath, ['runtime/server.mjs'], { cwd: root, env: { ...process.env, DATA_DIR: folder, PORT: String(port), HOST: '127.0.0.1', LOCAL_PREVIEW: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Server timeout: ' + output)), 15000);
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('服务已启动')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => output += chunk);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Server exited ' + code + output)); });
  });
  const login = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0];
});
after(async () => {
  if (child?.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
  if (folder) await rm(folder, { recursive: true, force: true });
});
async function upload(file) {
  const size = (await stat(file)).size;
  const begin = await post('video-begin', { size }); assert.equal(begin.status, 200);
  const job = await begin.json(), parts = [], handle = await open(file, 'r');
  try {
    for (let offset = 0; offset < size; offset += 8 * 1024 * 1024) {
      const count = Math.min(8 * 1024 * 1024, size - offset), body = Buffer.alloc(count);
      let done = 0;
      while (done < count) { const r = await handle.read(body, done, count - done, offset + done); if (!r.bytesRead) throw new Error('Unexpected file end'); done += r.bytesRead; }
      const part = parts.length + 1;
      const result = await request('/api/admin?' + new URLSearchParams({ action: 'video-part', key: job.key, id: job.uploadId, part: String(part) }), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
      assert.equal(result.status, 200); parts.push(await result.json());
    }
  } finally { await handle.close(); }
  const response = await post('video-complete', { ...job, slot: 1, title: '兼容视频验证', description: '临时测试素材', parts });
  return { job, response, body: await response.json() };
}

test('151 MiB valid H264/AAC MP4 passes chunked upload unchanged, playback ranges and persisted first-slot selection', async () => {
  const sample = await readFile(path.join(root, 'tests/fixtures/h264-aac.mp4'));
  const file = path.join(folder, '151-MiB-h264.mp4'), size = 151 * 1024 * 1024;
  const handle = await open(file, 'w');
  try {
    await handle.writeFile(sample);
    const free = Buffer.alloc(8); free.writeUInt32BE(size - sample.length); free.write('free', 4);
    await handle.write(free, 0, 8, sample.length); await handle.truncate(size);
  } finally { await handle.close(); }
  const result = await upload(file); assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.media.video.codec, 'avc1'); assert.equal(result.body.media.audio.codecString, 'mp4a.40.2');
  const saved = path.join(folder, 'media', result.job.key);
  assert.equal((await stat(saved)).size, size); assert.equal(await digest(saved), await digest(file));
  published = '/api/media/' + result.job.key;
  const gallery = await (await request('/api/gallery')).json(); assert.equal(gallery.videos[0].url, published);
  const input = await open(file, 'r');
  try {
    for (const start of [0, 70 * 1024 * 1024, size - 64]) {
      const ranged = await request(published, { headers: { Range: `bytes=${start}-${start + 63}` } });
      assert.equal(ranged.status, 206); assert.equal(ranged.headers.get('content-range'), `bytes ${start}-${start + 63}/${size}`);
      const expected = Buffer.alloc(64); await input.read(expected, 0, 64, start);
      assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), expected);
    }
  } finally { await input.close(); }
});

test('desktop restart keeps the uploaded first movie and reports it without requesting a manual asset', async () => {
  const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped;
  const savedConfig = await readFile(path.join(folder, 'config.json'), 'utf8');
  const port = new URL(origin).port;
  child = spawn(process.execPath, ['scripts/start-media-supplement.mjs', '--local', '--no-open'], { cwd: root, env: { ...process.env, DATA_DIR: folder, PORT: port }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Desktop restart timed out: ' + output)), 15000);
    child.stdout.on('data', bytes => { output += bytes; if (output.includes('影片1当前来源：后台已上传的视频')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', bytes => output += bytes);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Desktop restart exited ' + code + ': ' + output)); });
  });
  assert.doesNotMatch(output, /新视频尚未放入/);
  assert.equal((await (await request('/api/gallery')).json()).videos[0].url, published);
  const connect = await request('/connect');
  assert.equal(connect.status, 200);
  const html = await connect.text();
  assert.ok(html.includes(origin + '/admin'));
  assert.ok(html.includes('打开展馆主网页'));
  assert.doesNotMatch(html, /file:\/\/\//);
  assert.equal(await readFile(path.join(folder, 'config.json'), 'utf8'), savedConfig);
});

test('audio-only, HEVC and damaged MP4 cannot replace the published video; failures explain encoding and leave no final file', async () => {
  for (const fixture of ['audio-only.mp4', 'hevc-aac.mp4', 'damaged.mp4']) {
    let file = path.join(root, 'tests/fixtures', fixture);
    if (fixture === 'damaged.mp4') { file = path.join(folder, fixture); const b = Buffer.alloc(64); b.writeUInt32BE(24); b.write('ftypisom', 4); await writeFile(file, b); }
    const result = await upload(file);
    assert.equal(result.response.status, 415, JSON.stringify(result.body));
    assert.match(result.body.error, /H\.264/); assert.ok(result.body.code.startsWith('MP4_'));
    assert.equal((await (await request('/api/gallery')).json()).videos[0].url, published);
    await assert.rejects(access(path.join(folder, 'media', result.job.key)), { code: 'ENOENT' });
    await assert.rejects(access(path.join(folder, 'media', result.job.key) + '.tmp'), { code: 'ENOENT' });
    assert.equal((await post('video-abort', { ...result.job, id: result.job.uploadId })).status, 200);
  }
});
