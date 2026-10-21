import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { importCrownFolder } from '../scripts/import-crown-folder.mjs';
import { applyMediaPackage } from '../scripts/apply-media-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'src/media-supplement.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('extracted Windows frames install incrementally, preserving video validation and user data', async t => {
  await mkdir(path.join(root, 'work'), { recursive: true });
  const temp = await mkdtemp(path.join(root, 'work/crown-folder-'));
  const project = path.join(temp, '原部署包 1.4.2');
  const payload = path.join(temp, '小添加包/payload');
  const source = path.join(temp, '凤冠360 原素材');
  const frames = path.join(source, 'frames');
  try {
    for (const name of ['runtime', 'dist/assets', 'data']) await mkdir(path.join(project, name), { recursive: true });
    await mkdir(frames, { recursive: true });
    await copyFile(path.join(root, 'package.json'), path.join(project, 'package.json'));
    const currentStorage = await readFile(path.join(root, 'runtime/storage.mjs'), 'utf8');
    const previousStorage = currentStorage
      .replace("import { supplementGallery } from './media-supplement.mjs';\n", '')
      .replace('async function galleryBeforeMediaSupplement()', 'export async function gallery()')
      .replace(/\n\/\/ hengxiao-media-supplement:2026-10-20\nexport async function gallery\(\)\{return supplementGallery\(await galleryBeforeMediaSupplement\(\)\);\}\n$/, '');
    assert.match(previousStorage, /validateVideoFile/);
    await writeFile(path.join(project, 'runtime/storage.mjs'), previousStorage);
    await copyFile(path.join(root, 'runtime/server.mjs'), path.join(project, 'runtime/server.mjs'));
    await writeFile(path.join(project, 'data/config.json'), 'saved-password-and-origin');
    await writeFile(path.join(project, 'data/uploaded-video.mp4'), 'existing-user-media');
    const payloadFiles = ['runtime/media-supplement.mjs', 'src/media-supplement.json',
      'scripts/install-media-supplement.mjs', 'scripts/import-crown-folder.mjs', 'scripts/windows-node.bat',
      'Windows_导入凤冠91帧_本次补充.bat', 'docs/WINDOWS_CROWN360_20261021.md',
      'docs/DESKTOP_ADDONS_GUIDE_20261021.html', 'docs/DESKTOP_ADDONS_GUIDE_20261021.txt'];
    const checksums = [];
    for (const name of payloadFiles) {
      const bytes = await readFile(path.join(root, name));
      await mkdir(path.dirname(path.join(payload, name)), { recursive: true });
      await writeFile(path.join(payload, name), bytes);
      checksums.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
    }
    await writeFile(path.join(payload, 'package-manifest.json'), JSON.stringify(checksums));
    for (const [index, entry] of manifest.frames.entries()) {
      await copyFile(path.join(root, 'dist', entry.path), path.join(frames, `frame_${String(index + 1).padStart(3, '0')}.webp`));
    }

    await t.test('small package requests frames and keeps original service intact until import', async () => {
      assert.deepEqual(await applyMediaPackage(project, payload), { needsFrames: true });
      assert.equal(await readFile(path.join(project, 'runtime/storage.mjs'), 'utf8'), previousStorage);
      assert.match(await readFile(path.join(project, 'docs/DESKTOP_ADDONS_GUIDE_20261021.html'), 'utf8'), /Control\+C/);
    });
    await t.test('missing or corrupt last frame leaves all target images untouched', async () => {
      const last = path.join(frames, 'frame_091.webp');
      const original = await readFile(last);
      await rm(last);
      await assert.rejects(importCrownFolder(frames, project), /ENOENT/);
      assert.deepEqual(await readdir(path.join(project, 'dist/assets')), []);
      await writeFile(last, 'not-the-original-image');
      await assert.rejects(importCrownFolder(source, project), /第91帧/);
      assert.deepEqual(await readdir(path.join(project, 'dist/assets')), []);
      await writeFile(last, original);
    });
    await t.test('an existing different destination is preserved before adding other images', async () => {
      const destination = path.join(project, 'dist', manifest.frames[90].path);
      await writeFile(destination, 'do-not-replace');
      await assert.rejects(importCrownFolder(frames, project), /已有不同内容/);
      assert.equal(await readFile(destination, 'utf8'), 'do-not-replace');
      assert.equal((await readdir(path.join(project, 'dist/assets'))).length, 1);
      await rm(destination);
    });
    let patchedStorage;
    await t.test('parent folder imports 91 original bytes and preserves the installed video fix', async () => {
      await importCrownFolder(source, project);
      for (const entry of manifest.frames) {
        assert.equal(digest(await readFile(path.join(project, 'dist', entry.path))), entry.sha256);
      }
      patchedStorage = await readFile(path.join(project, 'runtime/storage.mjs'), 'utf8');
      assert.match(patchedStorage, /hengxiao-media-supplement:2026-10-20/);
      assert.match(patchedStorage, /validateVideoFile/);
      assert.equal(await readFile(path.join(project, 'backups/media-supplement-20261020/storage.mjs'), 'utf8'), previousStorage);
    });
    await t.test('direct frames folder and repeated package application reuse existing media', async () => {
      await importCrownFolder(frames, project);
      assert.deepEqual(await applyMediaPackage(project, payload), { needsFrames: false });
      assert.equal(await readFile(path.join(project, 'runtime/storage.mjs'), 'utf8'), patchedStorage);
      assert.equal((await readdir(path.join(project, 'dist/assets'))).length, 91);
      assert.equal(await readFile(path.join(project, 'data/config.json'), 'utf8'), 'saved-password-and-origin');
      assert.equal(await readFile(path.join(project, 'data/uploaded-video.mp4'), 'utf8'), 'existing-user-media');
    });
  } finally { await rm(temp, { recursive: true, force: true }); }
});
