#!/usr/bin/env python3
"""Wrap verified complete ZIPs into two download files below the connector limit."""
import hashlib
import json
from pathlib import Path
import shutil
import stat
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
folder = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'work/desktop-packages'
out = folder / 'downloads'
out.mkdir(exist_ok=True)
version = json.loads((root / 'package.json').read_text())['version']
results = []
for package in json.loads((folder / 'desktop-packages.json').read_text()):
    complete = Path(package['file'])
    # Keep both downloads below the 100MiB tool/Git file limit, including wrapper overhead.
    unit = 1024 * 1024
    limit = ((complete.stat().st_size + 1) // 2 + unit - 1) // unit * unit
    if limit > 99 * unit or complete.stat().st_size - limit > 99 * unit:
        raise RuntimeError('Complete ZIP needs more than two downloads; no oversized segment was produced.')
    first = out / (complete.name + '.part1')
    second = out / (complete.name + '.part2')
    digest = hashlib.sha256()
    with complete.open('rb') as source, first.open('wb') as a, second.open('wb') as b:
        count = 0
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
            (a if count < limit else b).write(block)
            count += len(block)
    assert digest.hexdigest() == package['sha256']
    manifest = {'version': version, 'projectFolder': f'hengxiao-yiyun-{version}-desktop', 'first': first.name, 'second': second.name, 'firstBytes': first.stat().st_size,
                'secondBytes': second.stat().st_size, 'complete': complete.name, 'sha256': package['sha256']}
    platform = package['platform']
    items = {'transfer-info.json': (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()}
    if platform == 'Windows':
        script = (root / 'scripts/merge-desktop.ps1').read_bytes()
        items['merge-desktop.ps1'] = b'\xef\xbb\xbf' + script.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        items['Windows_生成并解压完整包.bat'] = b'@echo off\r\nsetlocal\r\npowershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0merge-desktop.ps1"\r\nset "MERGE_STATUS=%ERRORLEVEL%"\r\npause\r\nexit /b %MERGE_STATUS%\r\n'
        entry = 'Windows_生成并解压完整包.bat'
    else:
        items['Mac_生成并解压完整包.command'] = (root / 'scripts/merge-desktop.command').read_bytes()
        values = {'FIRST': first.name, 'SECOND': second.name, 'FIRST_BYTES': manifest['firstBytes'],
                  'SECOND_BYTES': manifest['secondBytes'], 'COMPLETE': complete.name, 'SHA256': manifest['sha256'], 'YIYUN_VERSION':version, 'YIYUN_PROJECT_FOLDER':manifest['projectFolder']}
        items['transfer-info.sh'] = ''.join(f"{key}='{value}'\n" for key, value in values.items()).encode()
        entry = 'Mac_生成并解压完整包.command'
    items['先读操作说明.txt'] = f'''横小艺韵{version}完整部署包 · {platform}
完整包已生成且校验通过；为符合GitHub单文件100MiB限制，分成两个下载文件。
1. 下载本系统的第1包ZIP和第2段.part2文件。两个文件都必须下载完整。
2. 全部解压第1包ZIP。第2段保持原样，不用打开或解压。
3. 双击解压目录里的“{entry}”。弹窗中选择下载的本系统第2段文件。
4. 工具会校验、合并、解压，打开“完整部署包/hengxiao-yiyun-{version}-desktop”。不需要Node或额外解压软件。
5. 需要沿用旧data时，先停止旧服务，并在新包第一次启动之前复制旧data到新项目里。详见新项目“开始使用.html”。
6. 在新项目内双击本系统“同WiFi扫码启动”入口，首次设置管理员密码后，手机连接同一WiFi扫码。
Mac若阻止.command：右键该文件→打开，按系统提示允许；权限不足时在终端用chmod +x设置该文件执行权限。
Windows普通双击即可，不需要管理员身份。若出错窗口会保留提示。
合并工具只生成新完整包，不覆盖旧展馆，不删除下载段；新包已经整合Node、91帧和视频优化，不用再装旧补丁。
'''.encode()
    archive = out / f'hengxiao-yiyun-{version}-{platform}-01.zip'
    prefix = f'{platform}-完整部署下载/'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.write(first, prefix + first.name, compress_type=zipfile.ZIP_STORED)
        for name, data in items.items():
            info = zipfile.ZipInfo(prefix + name)
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.command') else 0o644)) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
    assert archive.stat().st_size < 100 * 1024 * 1024 and second.stat().st_size < 100 * 1024 * 1024
    result = {'platform': platform, 'firstDownload': str(archive), 'secondDownload': str(second), 'completeSha256': package['sha256']}
    results.append(result)
    print(json.dumps(result, ensure_ascii=False), flush=True)
(out / 'transfer-packages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
