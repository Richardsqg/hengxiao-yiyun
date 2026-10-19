import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, scryptSync } from 'node:crypto';
import { isPrivateIPv4, lanAddresses, validateLanOrigin } from '../runtime/preview-network.mjs';
import { createQrArtifacts } from '../runtime/qr.mjs';

const interfaces = {
  'VPN tun0': [{ address: '10.8.0.2', family: 'IPv4', internal: false }],
  'Wi-Fi': [{ address: '192.168.1.23', family: 'IPv4', internal: false }, { address: '::1', family: 'IPv6', internal: true }],
  loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
};

test('LAN address selection uses private IPv4 and prefers a normal network adapter', () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.23']) assert.equal(isPrivateIPv4(ip), true);
  for (const ip of ['127.0.0.1', '0.0.0.0', '172.32.0.1', '169.254.1.1', '8.8.8.8', '192.168.1.256', '192.168.01.1', '::1']) assert.equal(isPrivateIPv4(ip), false);
  assert.deepEqual(lanAddresses(interfaces), [{ name: 'Wi-Fi', address: '192.168.1.23' }, { name: 'VPN tun0', address: '10.8.0.2' }]);
});

test('LAN origin rejects public hosts, other computers, mismatched ports and URL additions', () => {
  assert.equal(validateLanOrigin('http://192.168.1.23:3000', 3000, interfaces), 'http://192.168.1.23:3000');
  for (const origin of ['https://192.168.1.23:3000', 'http://192.168.1.24:3000', 'http://192.168.1.23:3001', 'http://example.com:3000', 'http://127.0.0.1:3000', 'http://192.168.1.23:3000/admin', 'http://user:pass@192.168.1.23:3000', 'http://192.168.1.23:3000/?query', 'http://192.168.1.23:3000/#hash']) assert.throws(() => validateLanOrigin(origin, 3000, interfaces));
});

test('LAN preview keeps login protection, same-origin writes, matching QR and data across restart', async t => {
  const address = lanAddresses()[0]?.address;
  if (!address) { t.skip('This environment has no private IPv4 adapter'); return; }
  const folder = await mkdtemp(path.join(tmpdir(), 'yiyun-lan-'));
  const password = 'LAN-test-password-739';
  const config = { origin: 'https://existing.example', password: { salt: 'lan-test', hash: scryptSync(password, 'lan-test', 32).toString('hex') }, feedbackSalt: 'test-lan-only' };
  const saved = JSON.stringify(config);
  await writeFile(path.join(folder, 'config.json'), saved);
  const probe = net.createServer(); probe.listen(0, '0.0.0.0'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const origin = `http://${address}:${port}`;
  let child;
  async function start() {
    child = spawn(process.execPath, ['runtime/server.mjs'], { env: { ...process.env, DATA_DIR: folder, PORT: String(port), HOST: '127.0.0.1', LOCAL_PREVIEW: '0', LAN_PREVIEW: '1', PREVIEW_ORIGIN: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(new Error(output || 'Startup timed out')), 15000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('服务已启动')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', chunk => output += chunk);
      child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
    });
  }
  async function stop() { if (child?.exitCode === null) { const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped; } }
  try {
    await start();
    assert.equal((await fetch(origin + '/films')).status, 200);
    assert.equal((await fetch(origin + '/api/admin')).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 403);
    const post = (route, value, headers = {}) => fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
    for (const badOrigin of ['https://attacker.example', config.origin, `http://127.0.0.1:${port}`]) assert.equal((await post('/api/login', { password }, { Origin: badOrigin })).status, 403);
    const login = await post('/api/login', { password }); assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0]; assert.ok(!login.headers.get('set-cookie').includes('Secure'));
    const qr = Buffer.from(await (await fetch(origin + '/api/qr.png')).arrayBuffer());
    assert.deepEqual(qr, createQrArtifacts(origin).png);
    const qrFilms = Buffer.from(await (await fetch(origin + '/api/qr.png?section=films')).arrayBuffer());
    assert.deepEqual(qrFilms, createQrArtifacts(origin + '/films').png);
    assert.equal((await post('/api/feedback', { id: randomUUID(), rating: 5, favorite: '凤冠鉴赏', topics: ['工艺技法'], nickname: '局域网测试', message: '同 Wi-Fi 留言测试', consent: true })).status, 200);
    await stop(); await start();
    const result = await fetch(origin + '/api/admin', { headers: { Cookie: cookie } }); assert.equal(result.status, 200);
    const feedback = await result.json(); assert.equal(feedback.count, 1); assert.equal(feedback.rows[0].nickname, '局域网测试');
    assert.equal(await readFile(path.join(folder, 'config.json'), 'utf8'), saved);
  } finally { await stop(); await rm(folder, { recursive: true, force: true }); }
});
