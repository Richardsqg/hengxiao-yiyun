#!/usr/bin/env python3
"""Package the 1.4.3 cross-device UI update; reuse the host's existing Node/data."""
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
if json.loads((root / 'package.json').read_text())['version'] != '1.4.3':
    raise RuntimeError('此工具仅用于历史1.4.3补丁；当前完整版本请使用package-desktop.py，不要生成旧补丁。')
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'work/device-fix-package'
files = out / 'files'
files.mkdir(parents=True, exist_ok=True)
baselines = ['3b6340e', 'd63eb84', '09168b8', 'fd3c61f']
paths = ['web/Feedback.tsx', 'web/uuid.ts', 'web/ZoomStage.tsx', 'web/revision.css']
assets = re.findall(r'(?:src|href)="(/assets/index-[^"?]+\.(?:js|css))"', (root / 'dist/index.html').read_text())
assert len(assets) == 2
# Install the index last. Existing hashed assets are retained.
paths += ['dist' + asset for asset in assets] + ['dist/index.html']
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest, items = [], {}
for name in paths:
    content = (root / name).read_bytes()
    accepted = set()
    for ref in baselines:
        old = subprocess.run(['git', 'show', ref + ':' + name], cwd=root, capture_output=True)
        if old.returncode == 0:
            accepted.add(sha(old.stdout))
            accepted.add(sha(old.stdout.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')))
    manifest.append({'path': name, 'bytes': len(content), 'sha256': sha(content), 'before': sorted(accepted)})
    items['payload/' + name] = content
items['payload/desktop-hotfix-manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
items['install-desktop-hotfix.mjs'] = (root / 'scripts/install-desktop-hotfix.mjs').read_bytes()
items['install-device-fix.mjs'] = '''import {installDesktopHotfix} from './install-desktop-hotfix.mjs';
installDesktopHotfix(process.argv[2],process.argv[3],{
 backupFolder:'device-controls-feedback-20261021',
 successMessage:'跨设备按钮与留言修复已安装。原data、密码、留言和上传素材均保留。',
 instructions:['请用原启动文件重新运行。电脑刷新页面，手机退出旧页面后重新扫码。',
 '只需更新提供展馆的电脑，手机不用安装文件。请测试平移、四入口及一份留言。',
 '原程序文件备份：backups/device-controls-feedback-20261021。']
}).catch(error=>{console.error('修复未完成：'+error.message);process.exitCode=1});
'''.encode()
ps = r'''$ErrorActionPreference = 'Stop'
try {
 [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
 Add-Type -AssemblyName System.Windows.Forms
 Write-Host '先停止原展馆服务，再选择含package.json、runtime、dist的1.4.3项目文件夹。'
 $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
 $dialog.Description = '选择原1.4.3项目文件夹，不要选择data或runtime子目录'
 $dialog.ShowNewFolderButton = $false
 try {
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
  $project = $dialog.SelectedPath
 } finally { $dialog.Dispose() }
 $arch = 'x64'
 if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { $arch = 'arm64' }
 $candidates = @((Join-Path $project ('.runtime\win-' + $arch + '\node.exe')), (Join-Path $project 'runtime\node.exe'), (Join-Path $project 'node.exe'))
 $globalNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
 if ($globalNode) { $candidates += $globalNode[0].Source }
 $node = $null
 foreach ($candidate in $candidates) {
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
  & $candidate -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" *> $null
  if ($LASTEXITCODE -eq 0) { $node = $candidate; break }
 }
 if (-not $node) { throw '找不到Node24，请保留完整包内隐藏的.runtime文件夹。' }
 & $node (Join-Path $PSScriptRoot 'install-device-fix.mjs') $project (Join-Path $PSScriptRoot 'payload')
 exit $LASTEXITCODE
} catch { Write-Host ('修复未完成：' + $_.Exception.Message); exit 1 }
'''
items['install-windows.ps1'] = b'\xef\xbb\xbf' + ps.replace('\n', '\r\n').encode()
items['安装Windows交互与留言修复.bat'] = b'@echo off\r\nsetlocal\r\npowershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"\r\nset "FIX_STATUS=%ERRORLEVEL%"\r\npause\r\nexit /b %FIX_STATUS%\r\n'
mac = r'''#!/bin/bash
YIYUN_FIX_ROOT="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
yiyun_pause(){ if [ -t 0 ]; then printf '\n按回车关闭。'; read -r YIYUN_REPLY; fi; }
printf '请先在原展馆窗口按Control+C停止服务。\n'
if [ "$#" -gt 0 ]; then YIYUN_PROJECT="$1"
else YIYUN_PROJECT="$(osascript -e 'POSIX path of (choose folder with prompt "选择原1.4.3项目文件夹，里面应有package.json、runtime、dist")')" || { printf '已取消选择。\n'; yiyun_pause; exit 0; }; fi
YIYUN_ARCH=x64
if [ "$(uname -m)" = arm64 ]; then YIYUN_ARCH=arm64; fi
YIYUN_NODE="$YIYUN_PROJECT/.runtime/darwin-$YIYUN_ARCH/bin/node"
if [ ! -x "$YIYUN_NODE" ]; then YIYUN_NODE="$(command -v node)"; fi
if [ -z "$YIYUN_NODE" ] || ! "$YIYUN_NODE" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then
 printf '找不到可运行的Node24，请选择完整项目并保留隐藏的.runtime文件夹；Mac需macOS13.5或更新。\n'; yiyun_pause; exit 1
fi
"$YIYUN_NODE" "$YIYUN_FIX_ROOT/install-device-fix.mjs" "$YIYUN_PROJECT" "$YIYUN_FIX_ROOT/payload"
YIYUN_STATUS=$?
yiyun_pause
exit "$YIYUN_STATUS"
'''
items['安装Mac交互与留言修复.command'] = mac.encode()
items['先读操作说明.txt'] = (root / 'docs/DEVICE_CONTROLS_FEEDBACK_FIX_20261021.md').read_bytes()
items['源代码提交.txt'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root)
for name, content in items.items():
    destination = files / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    destination.chmod(0o755 if name.endswith('.command') else 0o644)
archive = out / '横小艺韵_1.4.3_交互与留言修复_20261021.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, content in items.items():
        info = zipfile.ZipInfo('hengxiao-device-fix/' + name)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.command') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, content)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'file': str(archive), 'files': str(files), 'bytes': archive.stat().st_size, 'sha256': sha(archive.read_bytes())}, ensure_ascii=False))
