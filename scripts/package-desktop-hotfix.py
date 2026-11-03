#!/usr/bin/env python3
"""Small Windows 1.4.3 update; no runtime, movies, pictures or user data."""
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
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'work/desktop-hotfix-package'
out.mkdir(parents=True, exist_ok=True)
baseline = 'd63eb84ab7a0eb1da4a863ecf8f6a19d5bb0a9d0'
files = ['runtime/server.mjs', 'runtime/connect-page.mjs', 'scripts/start-media-supplement.mjs',
         'scripts/open-browser.mjs', 'scripts/open-desktop-pages.mjs', 'web/Home.tsx', 'web/Dashboard.tsx',
         'web/media-events.ts', 'dist/index.html', 'Windows_打开入口.bat', 'docs/WINDOWS_PUBLISH_HOTFIX_20261021.md']
assets = re.findall(r'(?:src|href)="(/assets/index-[^"?]+\.(?:js|css))"', (root / 'dist/index.html').read_text())
assert len(assets) >= 2
files += ['dist' + asset for asset in assets]
manifest = []
items = {}
for name in files:
    data = (root / name).read_bytes()
    if name.endswith('.bat'):
        data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
    old = subprocess.run(['git', 'show', baseline + ':' + name], cwd=root, capture_output=True)
    before = []
    if old.returncode == 0:
        before = [hashlib.sha256(old.stdout).hexdigest(), hashlib.sha256(old.stdout.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')).hexdigest()]
    manifest.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'before': before})
    items['payload/' + name] = data
items['payload/desktop-hotfix-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
items['install-desktop-hotfix.mjs'] = (root / 'scripts/install-desktop-hotfix.mjs').read_bytes()
ps = r'''$ErrorActionPreference = 'Stop'
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    Write-Host '先停止旧服务。在弹窗里选择1.4.3项目文件夹，里面应有package.json、runtime、dist。'
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = '选择1.4.3项目文件夹：里面应有package.json、runtime、dist'
    $dialog.ShowNewFolderButton = $false
    try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Host '已取消。'; exit 0 }
        $project = $dialog.SelectedPath
    } finally { $dialog.Dispose() }
    $arch = 'x64'
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { $arch = 'arm64' }
    $candidates = @((Join-Path $project ('.runtime\win-' + $arch + '\node.exe')), (Join-Path $project 'node.exe'), (Join-Path $project 'node\node.exe'))
    $globalNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($globalNode) { $candidates += $globalNode[0].Source }
    $node = $null
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        & $candidate -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" *> $null
        if ($LASTEXITCODE -eq 0) { $node = $candidate; break }
    }
    if (-not $node) { throw '没有找到完整包内的Node。请确认选择的是项目目录，并保留隐藏的.runtime文件夹。' }
    & $node (Join-Path $PSScriptRoot 'install-desktop-hotfix.mjs') $project (Join-Path $PSScriptRoot 'payload')
    exit $LASTEXITCODE
} catch {
    Write-Host ('修复未完成：' + $_.Exception.Message)
    exit 1
}
'''
items['install-hotfix.ps1'] = b'\xef\xbb\xbf' + ps.replace('\n', '\r\n').encode()
items['安装Windows视频与入口修复.bat'] = b'@echo off\r\nsetlocal\r\npowershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-hotfix.ps1"\r\nset "FIX_STATUS=%ERRORLEVEL%"\r\npause\r\nexit /b %FIX_STATUS%\r\n'
items['先读操作说明.txt'] = (root / 'docs/WINDOWS_PUBLISH_HOTFIX_20261021.md').read_bytes()
archive = out / 'Windows_1.4.3_视频发布与扫码入口修复_20261021.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in items.items():
        info = zipfile.ZipInfo('hengxiao-windows-hotfix/' + name)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'file': str(archive), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, ensure_ascii=False))
