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
    'Windows_导入凤冠91帧_本次补充.bat',
    'docs/WINDOWS_CROWN360_20261021.md',
    'docs/DESKTOP_ADDONS_GUIDE_20261021.html',
    'docs/DESKTOP_ADDONS_GUIDE_20261021.txt',
]
installer = r'''@echo off
setlocal
chcp 65001 >nul
set "CROWN_ADDON=%~dp0"
set "CROWN_TARGET=%~1"
if not defined CROWN_TARGET (
 echo 请把原1.4.2-desktop中含package.json、runtime、dist的项目文件夹拖入本窗口。
 set /p "CROWN_TARGET=原项目文件夹："
)
set "CROWN_TARGET=%CROWN_TARGET:"=%"
if not exist "%CROWN_TARGET%\package.json" goto crown_wrong_folder
cd /d "%CROWN_TARGET%"
if errorlevel 1 goto crown_failed
call "%CROWN_ADDON%payload\scripts\windows-node.bat"
if errorlevel 1 goto crown_failed
"%MEDIA_NODE%" "%CROWN_ADDON%apply-media-package.mjs" "%CD%" "%CROWN_ADDON%payload"
if errorlevel 11 goto crown_failed
if errorlevel 10 goto crown_import
if errorlevel 1 goto crown_failed
goto crown_done
:crown_import
echo 请先将原凤冠91帧ZIP全部解压，再把frames文件夹拖入本窗口。
set /p "CROWN_FOLDER=图片文件夹："
set "CROWN_FOLDER=%CROWN_FOLDER:"=%"
"%MEDIA_NODE%" scripts\import-crown-folder.mjs "%CROWN_FOLDER%"
if errorlevel 1 goto crown_failed
:crown_done
echo 第一组凤冠360添加已完成。请使用原Windows启动入口重新运行展馆。
echo 详细操作手册在原项目docs\DESKTOP_ADDONS_GUIDE_20261021.html。
pause
exit /b 0
:crown_wrong_folder
echo 没有找到package.json。请重新运行，选择原项目目录，不要选择ZIP或dist目录。
pause
exit /b 1
:crown_failed
echo 添加没有完成，请查看上方提示。若仅尚未导入图片，可用原项目新增的Windows导入91帧入口继续。
echo 原密码、留言及已上传视频未由本安装器改写。
pause
exit /b 1
'''
readme = '''Windows第一组凤冠360小添加包（2026-10-21）
只含接入代码与说明，不含重复的91帧、不含视频、不含Node和依赖。
先关闭旧展馆。分别解压本添加包和已有的“凤冠360_网页轻量包_91帧.zip”。
双击“安装到原Windows包.bat”，先拖入原部署包中含package.json、runtime、dist的项目文件夹，回车；
再拖入原素材解压后的frames文件夹，回车。不要把ZIP拖到图片目录提示里。
自动核验91帧、逐个添加、接入第一展位。已存在且一致的图片会复用；不覆盖不同图片或data。
成功后用原Windows启动入口运行，网页按Ctrl+F5刷新，检查第一展位91帧。
中途没导入图片，可双击原项目新增的“Windows_导入凤冠91帧_本次补充.bat”继续。
完整Mac/Windows 360、停止旧服务和视频修复步骤：双击本包的“详细操作手册.html”。
该手册安装后也在原项目docs/DESKTOP_ADDONS_GUIDE_20261021.html。
已安装的视频上传修复会保留。添加包不改原密码、留言和管理员已经上传的其他素材。
原1.4.2 ZIP与Windows真机未提供，结构检查不匹配时会停止；不要手动替换整个runtime或dist。
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
archive = out / 'Windows_凤冠360添加包_适配1.4.2-desktop_20261021.zip'
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
