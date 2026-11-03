import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'src/media-supplement.json'), 'utf8'));
const frames = manifest.frames.map((entry, index) => {
  const expected = `/assets/crown-01-frame-${String(index + 1).padStart(3, '0')}.webp`;
  if (entry.path !== expected || !existsSync(path.join(root, 'dist', entry.path))) {
    throw new Error('第一组凤冠图片不完整，请重新合并本次补充包。');
  }
  return entry.path;
});
if (frames.length !== 91) throw new Error('本次凤冠素材应为完整91帧。');

export function firstVideoReady(relative = manifest.video.path) {
  const file = path.join(root, 'dist', relative);
  let handle;
  try {
    if (!statSync(file).isFile() || statSync(file).size < 32) return false;
    handle = openSync(file, 'r');
    const header = Buffer.alloc(12);
    readSync(handle, header, 0, header.length, 0);
    return header.toString('ascii', 4, 8) === 'ftyp';
  } catch { return false; }
  finally { if (handle !== undefined) closeSync(handle); }
}

// Defaults stay outside SQLite. Later uploads and the other seven exhibits retain priority.
export function supplementGallery(catalog) {
  const bundled = '/assets/film-01-qiasi-20261019-v2.mp4';
  const preferred = firstVideoReady() ? manifest.video.path : firstVideoReady(bundled) ? bundled : null;
  const crownFrames = { ...catalog.crownFrames };
  if (!Array.isArray(crownFrames['1']) || !crownFrames['1'].length) {
    crownFrames['1'] = catalog.frames?.length ? catalog.frames : [...frames];
  }
  const videos = catalog.videos.map(video => {
    if (video.slot !== 1 || video.hidden || !preferred) return video;
    if (!['/assets/film-01.mp4', manifest.video.path, bundled].includes(video.url)) return video;
    return {
      ...video, url: preferred, title: manifest.video.title,
      ...(preferred === bundled && video.poster === '/assets/film-01.jpg' ? {poster:'/assets/film-01-qiasi-20261019-v2.jpg'} : {}),
      description: manifest.video.description,
      ...(video.url === preferred ? {} : { captions: '', captionsUrl: '' }),
    };
  });
  return { ...catalog, videos, crownFrames, frames: crownFrames['1'] };
}
