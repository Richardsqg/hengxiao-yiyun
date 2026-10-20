import { useCallback, useEffect, useRef, useState } from 'react';
import { VIDEO_ENCODING_HELP } from './video-preflight';

type VideoPlayerProps = {
  src: string;
  poster?: string;
  captionsUrl?: string;
  label?: string;
  preload?: 'metadata' | 'auto';
  onFrameReady?: () => void;
  onIssue?: (message: string) => void;
  showIssue?: boolean;
};

export default function VideoPlayer({ src, poster, captionsUrl, label = '展馆影片', preload = 'metadata', onFrameReady, onIssue, showIssue = true }: VideoPlayerProps) {
  const player = useRef<HTMLVideoElement>(null);
  const [issue, setIssue] = useState('');
  const framePresented = useRef(false);
  const notifiedReady = useRef(false);
  const timer = useRef<number | null>(null);
  const frameCallback = useRef<number | null>(null);
  const callbacks = useRef({ onFrameReady, onIssue });
  callbacks.current = { onFrameReady, onIssue };
  const stopWatch = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const report = useCallback((message: string) => {
    stopWatch();
    setIssue(message);
    callbacks.current.onIssue?.(message);
  }, [stopWatch]);
  const ready = useCallback(() => {
    const video = player.current;
    if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) return;
    setIssue('');
    if (!notifiedReady.current) {
      notifiedReady.current = true;
      callbacks.current.onFrameReady?.();
    }
  }, []);
  const observeFrame = useCallback(() => {
    const video = player.current;
    if (!video || framePresented.current || frameCallback.current !== null) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameCallback.current = video.requestVideoFrameCallback(() => {
        frameCallback.current = null;
        framePresented.current = true;
        stopWatch();
        ready();
      });
    }
  }, [ready, stopWatch]);

  useEffect(() => {
    const video = player.current;
    framePresented.current = false;
    notifiedReady.current = false;
    setIssue('');
    return () => {
      stopWatch();
      if (frameCallback.current !== null && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback.current);
      frameCallback.current = null;
    };
  }, [src, stopWatch]);

  function metadata() {
    const video = player.current;
    if (video && (!video.videoWidth || !video.videoHeight)) {
      report(`影片没有可显示的视频画面；即使能够听到声音，也不能作为正常视频播放。${VIDEO_ENCODING_HELP}`);
      return;
    }
    observeFrame();
  }

  function loadedFrame() {
    observeFrame();
    const video = player.current;
    if (video && typeof video.requestVideoFrameCallback !== 'function' && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
      framePresented.current = true;
      ready();
    }
  }

  function playing() {
    stopWatch();
    const video = player.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) { metadata(); return; }
    observeFrame();
    if (framePresented.current) return;
    const start = video.currentTime;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (document.visibilityState !== 'visible' || video.paused || video.seeking || video.ended || video.readyState < 2 || video.currentTime <= start + .2 || framePresented.current) return;
      const decoded = video.getVideoPlaybackQuality?.().totalVideoFrames;
      if (decoded && decoded > 0) { framePresented.current = true; ready(); return; }
      report(`影片正在播放声音，但浏览器没有呈现视频画面，可能是编码不兼容或文件损坏。${VIDEO_ENCODING_HELP}`);
    }, 4500);
  }

  function failed() {
    const code = player.current?.error?.code;
    if (code === 1) return;
    report(code === 2
      ? '影片文件读取失败，请检查本地服务或网络连接后重试。'
      : `浏览器无法解码这部影片，可能是视频编码不兼容或文件损坏。${VIDEO_ENCODING_HELP}`);
  }

  return <>
    <video ref={player} src={src} controls playsInline preload={preload} poster={poster} aria-label={label}
      onLoadedMetadata={metadata} onLoadedData={loadedFrame} onPlaying={playing} onPause={stopWatch}
      onWaiting={stopWatch} onSeeking={stopWatch} onSeeked={() => { if (!player.current?.paused) playing(); }}
      onEnded={stopWatch} onError={failed}
      style={{ width: '100%', height: '100%', maxHeight: 680, objectFit: 'contain', background: '#081922' }}>
      {captionsUrl && <track kind="captions" srcLang="zh" label="中文字幕" src={captionsUrl} default />}
      你的浏览器暂不支持播放此视频。
    </video>
    {showIssue && issue && <p className="error" role="alert" style={{ position: 'absolute', zIndex: 1, left: 12, right: 12, top: 12, padding: 12, background: '#fff6ee', color: '#753820', fontSize: 12, lineHeight: 1.8 }}>{issue}</p>}
  </>;
}
