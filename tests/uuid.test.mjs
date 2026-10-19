import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createUuid } from '../web/uuid.ts';

test('UUID uses the browser native method when it is available', () => {
  const expected = '8e7d374f-2ada-4c80-91c5-2d079de2c7a9';
  const source = {
    randomUUID() { assert.equal(this, source); return expected; },
    getRandomValues() { assert.fail('Native UUID should not request another random value'); },
  };
  assert.equal(createUuid(source), expected);
});

test('plain-HTTP crypto without randomUUID generates an RFC UUID v4 with getRandomValues', () => {
  // Ordinary LAN HTTP exposes getRandomValues but does not expose randomUUID.
  for (const fill of [0x00, 0xff]) {
    let calls = 0;
    const source = {
      getRandomValues(bytes) {
        assert.equal(this, source);
        assert.equal(bytes.length, 16);
        calls++;
        return bytes.fill(fill);
      },
    };
    const uuid = createUuid(source);
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(uuid, fill === 0xff
      ? 'ffffffff-ffff-4fff-bfff-ffffffffffff'
      : '00000000-0000-4000-8000-000000000000');
    assert.equal(calls, 1);
  }
});

test('UUID fallback accepts the real Web Crypto random source without randomUUID', () => {
  const source = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  assert.match(createUuid(source), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('missing secure random source gives an actionable error instead of an insecure identifier', () => {
  for (const source of [null, {}]) {
    assert.throws(() => createUuid(source), /缺少安全随机数功能.*最新版系统浏览器/);
  }
});
