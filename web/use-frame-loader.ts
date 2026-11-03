import { useEffect, useRef, useState } from 'react';

function loadImage(source: string, signal: AbortSignal, refresh: boolean, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = new URL(source, location.origin);
    if (refresh) url.searchParams.set('image_retry', String(Date.now()));
    const finish = (error?: Error) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      if (error) { image.src = ''; reject(error); } else resolve(url.href);
    };
    const abort = () => finish(new DOMException('Loading cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('图片加载超时')), timeout);
    image.onload = () => image.naturalWidth ? finish() : finish(new Error('图片内容无效'));
    image.onerror = () => finish(new Error('图片未能载入'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else image.src = url.href;
  });
}

// Load the requested frame first, then only one neighbour. The original files
// stay intact. Keep the last successful frame visible during slow requests.
export function useFrameLoader(source: string, neighbour?: string, suspended = false) {
  const cache = useRef(new Map<string, string>());
  const [visible, setVisible] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [prefetching, setPrefetching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refreshSource = useRef('');

  useEffect(() => {
    if (!source || suspended) return;
    const controller = new AbortController();
    const { signal } = controller;
    setState('loading');
    setPrefetching(false);
    const save = (key: string, value: string) => {
      if (cache.current.size >= 160) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, value);
    };
    const run = async () => {
      try {
        let url = cache.current.get(source);
        const refresh = refreshSource.current === source;
        if (refresh) { cache.current.delete(source); url = undefined; refreshSource.current = ''; }
        if (!url) {
          for (let retry = 0; retry < 2; retry++) {
            try { url = await loadImage(source, signal, refresh || retry > 0, 30000); break; }
            catch (error) { if (signal.aborted || retry === 1) throw error; }
          }
          if (url) save(source, url);
        }
        if (signal.aborted || !url) return;
        setVisible(url);
        setState('ready');
        if (neighbour && neighbour !== source && !cache.current.has(neighbour)) {
          setPrefetching(true);
          try { save(neighbour, await loadImage(neighbour, signal, false, 15000)); }
          catch { /* Neighbour failures never mark the visible image as broken. */ }
          if (!signal.aborted) setPrefetching(false);
        }
      } catch {
        if (!signal.aborted) { setState('error'); setPrefetching(false); }
      }
    };
    void run();
    return () => controller.abort();
  }, [source, neighbour, suspended, attempt]);

  return {
    visible, state, prefetching,
    retry: () => { refreshSource.current = source; setAttempt(value => value + 1); },
    displayFailed: () => { cache.current.delete(source); setState('error'); },
  };
}
