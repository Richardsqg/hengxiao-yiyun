export const MEDIA_CHANGED = 'hengxiao-media-changed';
export function notifyMediaChanged() {
  window.dispatchEvent(new Event(MEDIA_CHANGED));
  try { localStorage.setItem(MEDIA_CHANGED, String(Date.now())); } catch { /* Focus refresh still works in private mode. */ }
}
