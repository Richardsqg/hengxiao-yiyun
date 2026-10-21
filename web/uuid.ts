type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

// Plain-HTTP LAN pages can use getRandomValues even when randomUUID is hidden.
export function createUuid(source: RandomSource | null | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') {
    try { return source.randomUUID(); } catch { /* Try the other secure browser API. */ }
  }
  if (typeof source?.getRandomValues !== 'function') {
    throw new Error('此浏览器缺少安全随机数功能，请使用最新版系统浏览器打开后再提交。');
  }
  let bytes: Uint8Array;
  try { bytes = source.getRandomValues(new Uint8Array(16)); }
  catch { throw new Error('浏览器暂时无法生成安全提交标识。内容已保留，请稍后重试或使用系统浏览器打开。'); }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
