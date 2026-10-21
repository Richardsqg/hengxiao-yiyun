import { spawn } from 'node:child_process';

export function browserLaunchPlans(target, platform = process.platform) {
  const url = new URL(target);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('浏览器入口必须是网页地址。');
  if (platform === 'darwin') return [{ command: '/usr/bin/open', args: [url.href] }];
  if (platform === 'win32') return [
    { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$ErrorActionPreference="Stop"; Start-Process -FilePath $env:HENGXIAO_OPEN_URL'], env: { HENGXIAO_OPEN_URL: url.href } },
    { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url.href] },
  ];
  return [];
}

export async function openBrowser(target, platform = process.platform) {
  for (const plan of browserLaunchPlans(target, platform)) {
    const success = await new Promise(resolve => {
      let child, timer;
      const finish = value => { clearTimeout(timer); resolve(value); };
      try {
        child = spawn(plan.command, plan.args, { env: { ...process.env, ...plan.env }, stdio: 'ignore', windowsHide: true });
        timer = setTimeout(() => { child.kill(); finish(false); }, 7000);
        child.once('error', () => finish(false));
        child.once('close', code => finish(code === 0));
      } catch { finish(false); }
    });
    if (success) return true;
  }
  console.log(`浏览器未自动打开时，请复制这个地址到浏览器：${target}`);
  return false;
}
