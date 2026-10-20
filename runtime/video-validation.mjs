import { open } from 'node:fs/promises';
import { inspectMp4 } from './mp4-inspect.mjs';
export { Mp4ValidationError } from './mp4-inspect.mjs';

// Seek over mdat; only bounded MP4 metadata is read into memory.
export async function validateVideoFile(file) {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    return await inspectMp4(async (offset, length) => {
      const bytes = Buffer.alloc(length);
      let done = 0;
      while (done < length) {
        const result = await handle.read(bytes, done, length - done, offset + done);
        if (!result.bytesRead) break;
        done += result.bytesRead;
      }
      return bytes.subarray(0, done);
    }, size);
  } finally { await handle.close(); }
}
