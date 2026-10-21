#!/usr/bin/env python3
"""Build a small, data-preserving update for the screenshot's Windows 1.4.3."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'work/stream-log-fix-package'
files = out / 'files'
files.mkdir(parents=True, exist_ok=True)
baseline = '09168b8'
before = subprocess.check_output(['git', 'show', baseline + ':runtime/server.mjs'], cwd=root)
server = (root / 'runtime/server.mjs').read_bytes()
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest = [{'path': 'runtime/server.mjs', 'bytes': len(server), 'sha256': sha(server),
             'before': [sha(before), sha(before.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))]}]
# Reuse the existing guarded installer; this update only supplies server.mjs.
installer = (root / 'scripts/install-desktop-hotfix.mjs').read_text()
for old, new in {
    'backups/windows-publish-hotfix-20261021': 'backups/stream-log-fix-20261021',
    'Windows启动与视频发布修复已安装。': 'CMD正常视频取消请求的日志修复已安装。',
    '请重新运行Windows_同WiFi扫码启动.bat；浏览器将打开网页形式的二维码入口。':
        '请用原来的启动文件重新运行展馆；正常切换和拖动视频将不再误报Request failed。',
    '已有页面按Ctrl+F5刷新一次。若浏览器没有弹出，可双击新增Windows_打开入口.bat，或复制终端里的网址。':
        '真实读取故障仍会记录。原程序备份在backups/stream-log-fix-20261021。',
}.items():
    assert old in installer
    installer = installer.replace(old, new)
ps = r'''$ErrorActionPreference = 'Stop'
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    Add-Type -AssemblyName System.Windows.Forms
    Write-Host '先在展馆黑色窗口按Ctrl+C停止服务，再选择含package.json、runtime、dist的1.4.3项目文件夹。'
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = '选择原1.4.3项目文件夹（不是data或runtime子目录）'
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
    if (-not $node) { throw '未找到Node24运行环境，请保留完整部署包内隐藏的.runtime文件夹。' }
    & $node (Join-Path $PSScriptRoot 'install-desktop-hotfix.mjs') $project (Join-Path $PSScriptRoot 'payload')
    exit $LASTEXITCODE
} catch { Write-Host ('修复未完成：' + $_.Exception.Message); exit 1 }
'''
items = {
    'payload/runtime/server.mjs': server,
    'payload/desktop-hotfix-manifest.json': (json.dumps(manifest, indent=2) + '\n').encode(),
    'install-desktop-hotfix.mjs': installer.encode(),
    'install-hotfix.ps1': b'\xef\xbb\xbf' + ps.replace('\n', '\r\n').encode(),
    '安装CMD日志修复.bat': b'@echo off\r\nsetlocal\r\npowershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-hotfix.ps1"\r\nset "FIX_STATUS=%ERRORLEVEL%"\r\npause\r\nexit /b %FIX_STATUS%\r\n',
    '先读操作说明.txt': (root / 'docs/CMD_STREAM_LOG_FIX_20261021.md').read_bytes(),
    '源代码提交.txt': (subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip() + '\n').encode(),
}
for name, data in items.items():
    destination = files / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
archive = out / 'Windows_1.4.3_CMD日志小修复_20261021.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in items.items():
        z.writestr('hengxiao-cmd-log-fix/' + name, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'file': str(archive), 'files': str(files), 'bytes': archive.stat().st_size, 'sha256': sha(archive.read_bytes())}, ensure_ascii=False))
