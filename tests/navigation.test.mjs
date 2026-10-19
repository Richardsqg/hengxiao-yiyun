import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionIds, sectionFromLocation, sectionUrl } from '../web/navigation.ts';

test('each independent module opens and refreshes in its own section, including a trailing slash', () => {
  for (const section of sectionIds) {
    for (const suffix of ['', '/']) {
      const location = new URL('http://localhost/' + section + suffix + '?from=bookmark#main');
      assert.equal(sectionFromLocation(location, true), section);
      assert.equal(sectionFromLocation(location), section);
    }
  }
});

test('normal entry and legacy home bookmarks still open the crown first', () => {
  for (const hash of ['', '#crown', '#culture', '#films', '#voices', '#unknown']) {
    assert.equal(sectionFromLocation({ pathname: '/', hash }, true), 'crown');
  }
  assert.equal(sectionFromLocation({ pathname: '/', hash: '#culture' }), 'culture');
  assert.equal(sectionFromLocation({ pathname: '/films', hash: '#culture' }), 'films');
});

test('public navigation URLs can be reopened and revisited without relying on a hash', () => {
  const start = new URL('http://localhost/?from=review#crown');
  const history = [start];
  for (const section of ['culture', 'films', 'voices']) {
    const target = sectionUrl(section, history.at(-1));
    assert.equal(target, '/' + section + '?from=review');
    history.push(new URL(target, start));
    assert.equal(sectionFromLocation(history.at(-1), true), section);
  }
  assert.deepEqual(history.toReversed().map(location => sectionFromLocation(location)), ['voices', 'films', 'culture', 'crown']);
});

test('draft navigation keeps the protected preview path and uses section anchors', () => {
  for (const pathname of ['/preview', '/preview/']) {
    for (const section of sectionIds) {
      const url = sectionUrl(section, { pathname, search: '?review=1' }, true);
      assert.equal(url, pathname + '?review=1#' + section);
      assert.equal(sectionFromLocation(new URL(url, 'http://localhost')), section);
    }
  }
});
