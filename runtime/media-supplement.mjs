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

export function firstVideoReady() {
  const file = path.join(root, 'dist', manifest.video.path);
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
  const crownFrames = { ...catalog.crownFrames };
  if (!Array.isArray(crownFrames['1']) || !crownFrames['1'].length) {
    crownFrames['1'] = catalog.frames?.length ? catalog.frames : [...frames];
  }
  const videos = catalog.videos.map(video => {
    if (video.slot !== 1 || video.hidden || !firstVideoReady()) return video;
    if (!['/assets/film-01.mp4', manifest.video.path].includes(video.url)) return video;
    return {
      ...video, url: manifest.video.path, title: manifest.video.title,
      description: manifest.video.description,
      ...(video.url === manifest.video.path ? {} : { captions: '', captionsUrl: '' }),
    };
  });
  return { ...catalog, videos, crownFrames, frames: crownFrames['1'] };
}
