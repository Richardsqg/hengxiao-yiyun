import { useCallback, useEffect, useRef, useState } from 'react';
import { VIDEO_ENCODING_HELP } from './video-preflight';

type VideoPlayerProps = {
  src: string;
  poster?: string;
  captionsUrl?: string;
  label?: string;
  preload?: 'none' | 'metadata' | 'auto';
  onFrameReady?: () => void;
  onIssue?: (message: string) => void;
  showIssue?: boolean;
};

export default function VideoPlayer({ src, poster, captionsUrl, label = '展馆影片', preload = 'metadata', onFrameReady, onIssue, showIssue = true }: VideoPlayerProps) {
  const player = useRef<HTMLVideoElement>(null);
  const [issue, setIssue] = useState('');
  const [buffering, setBuffering] = useState(false);
  const bufferTimer = useRef<number | null>(null);
  const resumeAt = useRef(0);
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
  const stopBuffer = useCallback(() => {
    if (bufferTimer.current !== null) clearTimeout(bufferTimer.current);
    bufferTimer.current = null;
    setBuffering(false);
  }, []);
  const report = useCallback((message: string) => {
    stopWatch();
    stopBuffer();
    setIssue(message);
    callbacks.current.onIssue?.(message);
  }, [stopWatch, stopBuffer]);
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
    resumeAt.current = 0;
    setIssue('');
    return () => {
      stopWatch();
      stopBuffer();
      if (frameCallback.current !== null && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback.current);
      frameCallback.current = null;
    };
  }, [src, stopWatch, stopBuffer]);

  function metadata() {
    const video = player.current;
    if (video && resumeAt.current > 0) {
      const position = resumeAt.current;
      resumeAt.current = 0;
      if (Number.isFinite(video.duration) && position < video.duration) video.currentTime = position;
    }
    if (video && (!video.videoWidth || !video.videoHeight)) {
      report(`影片没有可显示的视频画面；即使能够听到声音，也不能作为正常视频播放。${VIDEO_ENCODING_HELP}`);
      return;
    }
    observeFrame();
  }

  function loadedFrame() {
    stopBuffer();
    observeFrame();
    const video = player.current;
    if (video && typeof video.requestVideoFrameCallback !== 'function' && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
      framePresented.current = true;
      ready();
    }
  }

  function playing() {
    stopBuffer();
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
      : code === 3 ? `浏览器无法解码这部影片，可能是视频编码不兼容或文件损坏。${VIDEO_ENCODING_HELP}`
      : `影片暂时无法打开，可能是连接中断、文件地址无效或格式不支持。请先重试或检查连接。${VIDEO_ENCODING_HELP}`);
  }

  function waiting() {
    stopWatch();
    if (player.current?.paused) return;
    if (bufferTimer.current !== null) return;
    bufferTimer.current = window.setTimeout(() => { bufferTimer.current = null; setBuffering(true); }, 4000);
  }

  function retry() {
    const video = player.current;
    if (!video) return;
    resumeAt.current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    stopWatch(); stopBuffer(); setIssue('');
    framePresented.current = false; notifiedReady.current = false;
    if (frameCallback.current !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback.current);
    frameCallback.current = null;
    video.load();
    void video.play().catch(error => {
      if (error?.name === 'NotAllowedError') setIssue('影片已重新载入，请点击播放器的播放键继续。');
    });
  }

  return <>
    <video ref={player} src={src} controls playsInline preload={preload} poster={poster} aria-label={label}
      onLoadedMetadata={metadata} onLoadedData={loadedFrame} onPlaying={playing} onPause={() => { stopWatch(); stopBuffer(); }}
      onWaiting={waiting} onStalled={waiting} onLoadStart={waiting} onSeeking={stopWatch} onSeeked={() => { if (!player.current?.paused) playing(); }}
      onEnded={() => { stopWatch(); stopBuffer(); }} onError={failed}
      style={{ width: '100%', height: '100%', maxHeight: 680, objectFit: 'contain', background: '#081922' }}>
      {captionsUrl && <track kind="captions" srcLang="zh" label="中文字幕" src={captionsUrl} default />}
      你的浏览器暂不支持播放此视频。
    </video>
    {showIssue && (issue || buffering) && <div className="video-recovery" role={issue?'alert':'status'}><p>{issue || '网络较慢，影片正在缓冲。可稍候，或重新载入继续播放。'}</p><div className="media-recovery"><button type="button" onClick={retry}>重新载入视频</button><a href="/connect" target="_blank" rel="noopener">检查连接</a></div></div>}
  </>;
}
