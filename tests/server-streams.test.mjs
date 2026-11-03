import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, open, rm } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploaded = '11111111-1111-4111-8111-111111111111.mp4';
const readFailure = '22222222-2222-4222-8222-222222222222.mp4';
const sourceClose = '33333333-3333-4333-8333-333333333333.mp4';
let folder, child, origin, stderr = '';

before(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'yiyun-streams-'));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  const password = randomBytes(24).toString('hex');
  await writeFile(path.join(folder, 'config.json'), JSON.stringify({
    origin,
    password: { salt: 'stream-test', hash: scryptSync(password, 'stream-test', 32).toString('hex') },
    feedbackSalt: 'stream-test',
  }));
  const media = path.join(folder, 'media', 'videos');
  await mkdir(media, { recursive: true });
  for (const name of [uploaded, readFailure, sourceClose]) {
    const file = await open(path.join(media, name), 'w');
    try { await file.truncate(64 * 1024 * 1024); } finally { await file.close(); }
  }
  // Test-only failures prove an unexpected source closure is still reported,
  // even when its code matches the browser-cancellation error.
  const preload = path.join(folder, 'read-faults.mjs');
  await writeFile(preload, `
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.createReadStream;
fs.createReadStream = function(file, options) {
  if (String(file).endsWith(${JSON.stringify(readFailure)})) {
    return new Readable({read() { this.destroy(Object.assign(new Error('test disk read failure'), {code:'EIO'})); }});
  }
  if (String(file).endsWith(${JSON.stringify(sourceClose)})) {
    return new Readable({read() { this.destroy(); }});
  }
  return original(file, options);
};
syncBuiltinESMExports();
`);
  child = spawn(process.execPath, ['--import', preload, 'runtime/server.mjs'], {
    cwd: root,
    env: { ...process.env, DATA_DIR: folder, PORT: String(port), HOST: '127.0.0.1', LOCAL_PREVIEW: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    let stdout = '';
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${stdout}\n${stderr}`)), 15000);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('服务已启动')) { clearTimeout(timer); resolve(); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${stderr}`)); });
  });
});

after(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function healthy() {
  const response = await fetch(origin + '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  await delay(50); // Allow the child stderr pipe to deliver completed-request logs.
}

function cancelMedia(url, headers = {}) {
  return new Promise((resolve, reject) => {
    let cancelled = false;
    const request = http.get(origin + url, { headers, agent: false }, response => {
      response.once('data', () => { cancelled = true; response.destroy(); });
      response.once('error', error => { if (!cancelled) reject(error); });
      response.once('close', () => cancelled ? resolve(response.statusCode) : reject(new Error('No media data received')));
    });
    request.once('error', error => { if (!cancelled) reject(error); });
  });
}

function expectBrokenSource(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(origin + url, { agent: false }, response => {
      response.resume();
      response.once('error', resolve);
      response.once('end', () => reject(new Error('Broken source unexpectedly completed')));
    });
    request.once('error', resolve);
  });
}

test('cancelling a default video is quiet and the server keeps serving requests', async () => {
  const before = stderr.length;
  assert.equal(await cancelMedia('/assets/film-02.mp4'), 200);
  await healthy();
  assert.doesNotMatch(stderr.slice(before), /Request failed:/);
});

test('cancelling an uploaded video range is quiet and seeking still works', async () => {
  const before = stderr.length;
  const url = '/api/media/videos/' + uploaded;
  assert.equal(await cancelMedia(url, { Range: 'bytes=1024-' }), 206);
  await healthy();
  assert.doesNotMatch(stderr.slice(before), /Request failed:/);
  const resumed = await fetch(origin + url, { headers: { Range: 'bytes=2048-2111' } });
  assert.equal(resumed.status, 206);
  assert.equal(resumed.headers.get('content-range'), 'bytes 2048-2111/67108864');
  assert.equal((await resumed.arrayBuffer()).byteLength, 64);
});

test('a real disk-read error is still reported', async () => {
  const before = stderr.length;
  await expectBrokenSource('/api/media/videos/' + readFailure);
  await healthy();
  assert.match(stderr.slice(before), /Request failed: EIO/);
});

test('an unexpected source closure is still reported with the same error code', async () => {
  const before = stderr.length;
  await expectBrokenSource('/api/media/videos/' + sourceClose);
  await healthy();
  assert.match(stderr.slice(before), /Request failed: ERR_STREAM_PREMATURE_CLOSE/);
});
