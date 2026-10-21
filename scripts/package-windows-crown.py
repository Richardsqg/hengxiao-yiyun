#!/usr/bin/env python3
"""Make the small Windows crown add-on; reuse the user's extracted 91 frames."""
import hashlib
import json
from pathlib import Path
import stat
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'work/windows-crown-package'
out.mkdir(parents=True, exist_ok=True)
files = [
    'runtime/media-supplement.mjs',
    'src/media-supplement.json',
    'scripts/install-media-supplement.mjs',
    'scripts/import-crown-folder.mjs',
    'scripts/windows-node.bat',
    'scripts/windows-crown-ui.ps1',
    'Windows_导入凤冠91帧_本次补充.bat',
    'docs/WINDOWS_CROWN360_20261021.md',
    'docs/DESKTOP_ADDONS_GUIDE_20261021.html',
    'docs/DESKTOP_ADDONS_GUIDE_20261021.txt',
]
installer = r'''@echo off
setlocal
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0payload\scripts\windows-crown-ui.ps1" -PackageRoot "%~dp0."
set "CROWN_RESULT=%ERRORLEVEL%"
echo.
echo Installer exit code: %CROWN_RESULT%
echo Please keep this window open if you need to copy an error message.
pause
exit /b %CROWN_RESULT%
'''
readme = '''Windows第一组凤冠360小添加包 v2（文件夹选择框版，2026-10-21）
修正旧入口拖入路径时窗口关闭、看不到错误的问题：本版不用拖文件夹。
只含接入代码与说明，不含重复91帧、不含视频、不含Node和依赖。
1. 先关闭旧展馆，分别全部解压本添加包和原“凤冠360_网页轻量包_91帧.zip”。
2. 普通双击“安装到原Windows包.bat”。在弹出的选择框里找到原项目文件夹；该文件夹里面应有package.json、runtime、dist。选中文件夹后点确定。
3. 再在第二个选择框里选择原素材解压后的frames文件夹，里面应有frame_001.webp至frame_091.webp。
4. 等待成功提示，回到原部署包使用原启动入口运行，网页按Ctrl+F5刷新。
不需要把任何文件夹拖入黑色窗口，不需要以管理员身份运行。
结束后黑色窗口会等待按键，方便读取报错；日志路径也显示在窗口里。
如果没有弹出选择框，请先看任务栏中是否有等待选择的窗口；若提示PowerShell不可用或受限，保留黑色窗口中的完整报错。
图片导入中断，可用原项目新增的“Windows_导入凤冠91帧_本次补充.bat”继续，它也改为选择框。
原密码、留言、已上传视频和已经安装的视频修复会保留；已有图片一致时复用，不覆盖不同素材。
完整Mac/Windows步骤：双击本包“详细操作手册.html”。安装后原项目docs目录中也有。
未在用户原1.4.2 ZIP或Windows真机测试。目录结构不匹配时停止并显示提示。
'''
items = {}
manifest = []
for name in files:
    data = (root / name).read_bytes()
    if name.endswith('.bat'):
        data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
    items['payload/' + name] = data
    manifest.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
items['payload/package-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
items['apply-media-package.mjs'] = (root / 'scripts/apply-media-package.mjs').read_bytes()
items['安装到原Windows包.bat'] = installer.replace('\n', '\r\n').encode()
items['先读这里.txt'] = readme.encode()
items['详细操作手册.html'] = (root / 'docs/DESKTOP_ADDONS_GUIDE_20261021.html').read_bytes()
archive = out / 'Windows_凤冠360添加包_适配1.4.2-desktop_20261021_v2.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in items.items():
        info = zipfile.ZipInfo('hengxiao-windows-crown-addon/' + name)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'file': str(archive), 'bytes': archive.stat().st_size,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, ensure_ascii=False))
