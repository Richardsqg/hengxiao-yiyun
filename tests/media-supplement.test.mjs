import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { scryptSync, randomUUID } from 'node:crypto';
import { installMediaSupplement } from '../scripts/install-media-supplement.mjs';
import { importFirstVideo } from '../scripts/import-first-video.mjs';
import { lanAddresses } from '../scripts/start-media-supplement.mjs';
import { createQrArtifacts } from '../runtime/qr.mjs';
import { supplementGallery } from '../runtime/media-supplement.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('new media defaults preserve uploaded first crown and all other exhibits', () => {
  const videos = [{ slot: 1, url: '/assets/film-01.mp4' }, { slot: 2, url: '/assets/film-02.mp4' }];
  const second = ['/api/media/frames/existing.webp'];
  const supplied = supplementGallery({ videos, crownFrames: { '2': second }, frames: [] });
  assert.equal(supplied.frames.length, 91);
  assert.equal(supplied.frames[0], '/assets/crown-01-frame-001.webp');
  assert.equal(supplied.frames[90], '/assets/crown-01-frame-091.webp');
  assert.equal(supplied.crownFrames['2'], second);
  assert.equal(supplied.videos[1], videos[1]);
  const uploaded = ['/api/media/frames/real-upload.webp'];
  assert.equal(supplementGallery({ videos, crownFrames: { '1': uploaded }, frames: uploaded }).frames, uploaded);
});

test('bundled first film never replaces a hidden or uploaded first video',()=>{
 for(const video of [{slot:1,url:'/api/media/videos/teacher-upload.mp4'},{slot:1,url:'/assets/film-01.mp4',hidden:true}]){
  const result=supplementGallery({videos:[video],crownFrames:{},frames:[]});assert.equal(result.videos[0],video);
 }
});

test('LAN discovery chooses physical private addresses and excludes VPN interfaces', () => {
  const address = (value, internal = false) => [{ address: value, family: 'IPv4', internal }];
  assert.deepEqual(lanAddresses({ utun0: address('10.9.0.1'), en1: address('172.20.1.3'), en0: address('192.168.1.20'), lo0: address('127.0.0.1', true), public: address('8.8.8.8') }), [
    { name: 'en0', address: '192.168.1.20' }, { name: 'en1', address: '172.20.1.3' },
  ]);
});

test('Windows Wi-Fi takes priority over virtual adapters, Ethernet and VPN', () => {
  const address = value => [{ address: value, family: 'IPv4', internal: false }];
  assert.deepEqual(lanAddresses({ 'vEthernet (Default Switch)': address('172.22.1.1'), Tailscale: address('10.1.0.1'), 'VirtualBox Host-Only Network': address('192.168.56.1'), Ethernet: address('192.168.2.10'), 'Wi-Fi': address('192.168.1.10') }), [
    { name: 'Wi-Fi', address: '192.168.1.10' }, { name: 'Ethernet', address: '192.168.2.10' },
  ]);
});

test('incremental installer and local/LAN browsing, first-video import and configuration preservation', async t => {
  await mkdir(path.join(root, 'work'), { recursive: true });
  const folder = await mkdtemp(path.join(root, 'work/media-supplement-test-'));
  let child;
  const stop = async () => {
    if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
    child = null;
  };
  try {
    for (const name of ['scripts', 'runtime', 'src']) await cp(path.join(root, name), path.join(folder, name), { recursive: true });
    await cp(path.join(root, 'package.json'), path.join(folder, 'package.json'));
    const currentStorage = await readFile(path.join(root, 'runtime/storage.mjs'), 'utf8');
    const originalStorage = currentStorage
      .replace("import { supplementGallery } from './media-supplement.mjs';\n", '')
      .replace('async function galleryBeforeMediaSupplement()', 'export async function gallery()')
      .replace(/\n\/\/ hengxiao-media-supplement:2026-10-20\nexport async function gallery\(\)\{return supplementGallery\(await galleryBeforeMediaSupplement\(\)\);\}\n$/, '');
    await writeFile(path.join(folder, 'runtime/storage.mjs'), originalStorage);
    await mkdir(path.join(folder, 'dist/assets'), { recursive: true });
    for (const entry of await readdir(path.join(root, 'dist/assets'))) {
      if (!['film-01-qiasi.mp4','film-01-qiasi-20261019-v2.mp4'].includes(entry)) await symlink(path.join(root, 'dist/assets', entry), path.join(folder, 'dist/assets', entry));
    }
    await symlink(path.join(root, 'dist/index.html'), path.join(folder, 'dist/index.html'));
    await symlink(path.join(root, 'media-parts'), path.join(folder, 'media-parts'), 'dir');
    await mkdir(path.join(folder, 'data'));
    const password = 'Supplement-test-only-8326';
    const savedConfig = JSON.stringify({ origin: 'https://saved-domain.example', password: { salt: 'test-salt', hash: scryptSync(password, 'test-salt', 32).toString('hex') }, feedbackSalt: 'test-feedback-only' });
    await writeFile(path.join(folder, 'data/config.json'), savedConfig);
    const savedServer = await readFile(path.join(folder, 'runtime/server.mjs'), 'utf8');

    await t.test('installer verifies originals and is idempotent without replacing server or data', async () => {
      await installMediaSupplement(folder);
      const oncePatched = await readFile(path.join(folder, 'runtime/storage.mjs'), 'utf8');
      await installMediaSupplement(folder);
      assert.equal(await readFile(path.join(folder, 'runtime/storage.mjs'), 'utf8'), oncePatched);
      assert.equal(await readFile(path.join(folder, 'backups/media-supplement-20261020/storage.mjs'), 'utf8'), originalStorage);
      assert.equal(await readFile(path.join(folder, 'runtime/server.mjs'), 'utf8'), savedServer);
      assert.equal(await readFile(path.join(folder, 'data/config.json'), 'utf8'), savedConfig);
    });

    async function start(lan = false) {
      const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
      const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
      const local = lanAddresses()[0]?.address;
      const env = { ...process.env, DATA_DIR: path.join(folder, 'data'), PORT: String(port), HOST: 'bad-inherited-host', LOCAL_PREVIEW: '1' };
      delete env.LAN_IP;
      if (lan) env.LAN_IP = local;
      child = spawn(process.execPath, ['scripts/start-media-supplement.mjs', lan ? '--lan' : '--local', '--no-open'], { cwd: folder, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Startup timed out: ' + output)), 15000);
        child.stdout.on('data', bytes => { output += bytes; if (output.includes('本次补充已启用')) { clearTimeout(timer); resolve(); } });
        child.stderr.on('data', bytes => output += bytes);
        child.once('exit', code => { clearTimeout(timer); reject(new Error('Startup exited ' + code + ': ' + output)); });
      });
      return `http://${lan ? local : '127.0.0.1'}:${port}`;
    }

    await t.test('local page exposes 91 supplied frames and retains old video until MP4 is placed', async () => {
      const origin = await start();
      assert.equal((await fetch(origin + '/')).status, 200);
      const catalog = await (await fetch(origin + '/api/gallery')).json();
      assert.equal(catalog.frames.length, 91);
      assert.equal(catalog.videos[0].url, '/assets/film-01.mp4');
      for (const index of [0, 90]) {
        const r = await fetch(origin + catalog.frames[index]);
        assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /image\/webp/);
        assert.ok((await r.arrayBuffer()).byteLength > 100000);
      }
      assert.equal(await (await fetch(origin + '/api/qr.svg')).text(), createQrArtifacts(origin).svg);
      const login = await fetch(origin + '/api/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      assert.equal(login.status, 200); assert.ok(!login.headers.get('set-cookie').includes('; Secure'));
      await stop();
    });

    await t.test('MP4 import checks format, protects existing files and selects the first slot with byte ranges', async () => {
      const bad = path.join(folder, 'bad.mp4'); await writeFile(bad, 'this is not a video');
      await assert.rejects(importFirstVideo(bad, folder), /MP4/);
      const sample = path.join(folder, 'sample.mp4');
      const bytes = await readFile(path.join(root, 'tests/fixtures/h264-aac.mp4'));
      await writeFile(sample, bytes);
      await importFirstVideo(sample, folder);
      await assert.rejects(importFirstVideo(sample, folder), /目标视频已存在/);
      const origin = await start();
      const catalog = await (await fetch(origin + '/api/gallery')).json();
      assert.equal(catalog.videos[0].url, '/assets/film-01-qiasi.mp4');
      assert.equal(catalog.videos[0].title, '掐丝珐琅');
      assert.doesNotMatch(catalog.videos[0].description, /36秒|静音/);
      assert.equal(catalog.videos[1].url, '/assets/film-02.mp4');
      const ranged = await fetch(origin + catalog.videos[0].url, { headers: { Range: 'bytes=0-63' } });
      assert.equal(ranged.status, 206); assert.equal((await ranged.arrayBuffer()).byteLength, 64);
      await stop();
    });

    await t.test('LAN QR points to private address, same-origin phone writes work and saved config stays intact', { skip: !lanAddresses().length }, async () => {
      const origin = await start(true);
      const qr = await (await fetch(origin + '/api/qr.svg')).text();
      assert.equal(qr, createQrArtifacts(origin).svg);
      const page = await readFile(path.join(folder, 'data/lan-connect.html'), 'utf8');
      assert.ok(page.includes(origin)); assert.ok(page.includes(qr)); assert.ok(!page.includes('127.0.0.1'));
      const input = { id: randomUUID(), rating: 5, favorite: '凤冠鉴赏', topics: ['工艺技法'], nickname: '局域网测试', message: '本次素材验证', consent: true };
      const submit = from => fetch(origin + '/api/feedback', { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      assert.equal((await submit(origin)).status, 200);
      assert.equal((await submit('https://attacker.example')).status, 403);
      assert.equal(await readFile(path.join(folder, 'data/config.json'), 'utf8'), savedConfig);
      assert.ok((await stat(path.join(folder, 'data/gallery.sqlite'))).size > 0);
      await stop();
    });
  } finally { await stop(); await rm(folder, { recursive: true, force: true }); }
});
