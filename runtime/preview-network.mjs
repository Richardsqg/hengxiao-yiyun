import { networkInterfaces } from 'node:os';

export function isPrivateIPv4(address) {
  const parts = String(address).split('.');
  if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p) || Number(p) > 255 || String(Number(p)) !== p)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function lanAddresses(interfaces = networkInterfaces()) {
  const entries = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses || []) {
      if (entry.internal || !['IPv4', 4].includes(entry.family) || !isPrivateIPv4(entry.address)) continue;
      if (!entries.some(item => item.address === entry.address)) entries.push({ name, address: entry.address });
    }
  }
  return entries.sort((a, b) => Number(/docker|veth|wsl|vpn|tun|tap|tailscale|vmnet|zerotier/i.test(a.name)) - Number(/docker|veth|wsl|vpn|tun|tap|tailscale|vmnet|zerotier/i.test(b.name)));
}

export function validateLanOrigin(raw, port, interfaces = networkInterfaces()) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('局域网网址无效，请使用一键启动重新选择本机 Wi-Fi 地址。'); }
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !isPrivateIPv4(url.hostname) || Number(url.port || 80) !== port || !lanAddresses(interfaces).some(item => item.address === url.hostname)) {
    throw new Error('局域网预览只允许本机网卡的私网 IPv4 地址，端口必须与服务相同。请使用一键启动重新选择。');
  }
  return url.origin;
}
