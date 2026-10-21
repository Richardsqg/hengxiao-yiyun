import { createQrArtifacts } from './qr.mjs';

export function connectPage(origin) {
  const site = new URL(origin).origin;
  const { svg } = createQrArtifacts(site);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>横小艺韵 · 手机扫码与展馆入口</title><style>body{font:18px system-ui;margin:35px auto;padding:0 24px;max-width:680px;background:#f5f2eb;color:#163745;text-align:center}svg{width:min(80vw,330px);height:auto}a{color:#124f68;word-break:break-all}p{line-height:1.8}.links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.links a{padding:12px 18px;border:1px solid #9eacaf;border-radius:6px;text-decoration:none}</style><h1>手机扫码看展馆</h1><p>手机与电脑连接同一路由器或 Wi-Fi，<br>用相机或微信扫描二维码。</p>${svg}<p><a href="${site}/">${site}</a></p><div class="links"><a href="${site}/" target="_blank" rel="noopener">打开展馆主网页</a><a href="${site}/admin" target="_blank" rel="noopener">打开管理员后台</a></div><p>保持启动窗口开启，电脑不要休眠。<br>局域网浏览不需要翻墙。</p><p>扫码打不开时，允许 Node 接收传入连接；<br>Windows 防火墙允许专用网络；避免访客 Wi-Fi 隔离。<br>换 Wi-Fi 后请重启扫码入口。</p></html>`;
}
