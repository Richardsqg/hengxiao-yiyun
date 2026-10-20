#!/usr/bin/env python3
"""Package the compiled upload/player fix, without video, pictures or dependencies."""
import hashlib,json,pathlib,re,stat,zipfile,sys
root=pathlib.Path(__file__).resolve().parent.parent
out=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'work/video-fix-packages';out.mkdir(parents=True,exist_ok=True)
common=['runtime/mp4-inspect.mjs','runtime/video-validation.mjs','src/mp4-inspect.ts',
'web/Dashboard.tsx','web/Home.tsx','web/VideoPlayer.tsx','web/video-preflight.ts',
'scripts/repair-video.mjs','scripts/import-first-video.mjs','scripts/media-node.sh','docs/VIDEO_UPLOAD_FIX_20261020.md']
assets=re.findall(r'(?:src|href)="(/assets/index-[^"?]+\.(?:js|css))"',(root/'dist/index.html').read_text())
assert len(assets)>=2
common += ['dist'+p for p in assets]
common += ['dist/index.html']
mac='''#!/bin/bash
fix_package="$(cd "$(dirname "$0")" && pwd)" || exit 1
fix_target="${1:-}"
if [ -z "$fix_target" ]; then
 fix_target=$(/usr/bin/osascript -e 'POSIX path of (choose folder with prompt "选择原展馆包中含package.json、runtime、dist的项目目录")') || exit 0
fi
cd "$fix_target" || exit 1
source "$fix_package/payload/scripts/media-node.sh" || exit 1
"$MEDIA_NODE" "$fix_package/install-video-upload-fix.mjs" "$PWD" "$fix_package/payload"
fix_status=$?
read -r -p '请查看上方结果，按回车关闭。'
exit "$fix_status"
'''
windows='''@echo off
setlocal
chcp 65001 >nul
set "FIX_TARGET=%~1"
if not defined FIX_TARGET (
 echo 请把原部署包中含package.json、runtime、dist的项目文件夹拖入本窗口。
 set /p "FIX_TARGET=按回车开始安装："
)
set "FIX_TARGET=%FIX_TARGET:"=%"
if not exist "%FIX_TARGET%\\package.json" (
 echo 所选目录没有package.json，请选择原项目目录。
 pause
 exit /b 1
)
set "FIX_NODE=node"
if exist "%FIX_TARGET%\\node.exe" set "FIX_NODE=%FIX_TARGET%\\node.exe"
if exist "%FIX_TARGET%\\node\\node.exe" set "FIX_NODE=%FIX_TARGET%\\node\\node.exe"
if exist "%FIX_TARGET%\\runtime\\node.exe" set "FIX_NODE=%FIX_TARGET%\\runtime\\node.exe"
"%FIX_NODE%" -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)"
if errorlevel 1 (
 echo 未找到Node.js 24.15或更新的24.x，请使用原包对应运行环境。
 pause
 exit /b 1
)
"%FIX_NODE%" "%~dp0install-video-upload-fix.mjs" "%FIX_TARGET%" "%~dp0payload"
pause
'''
readme='''视频上传与有声无画面补充包（不含视频、图片、Node或依赖）。
关闭旧服务后解压。Mac双击.command选择原项目目录；Windows双击.bat把原项目目录拖入窗口。
安装后用原启动入口重启，刷新后台，在“影片与360°”中选择原视频，播放预览确认后再替换。
当前上限400MiB，151MB无需压到30MB。新校验不等于自动转码既有文件；不兼容文件需要另存H.264/AAC兼容MP4后上传。
已有FFmpeg时可用新增“另存兼容视频”入口；没有时会明确停止，不自动下载大转码器。
原密码、留言和视频文件不由安装器改写；程序备份在backups/video-upload-fix-20261020。
完整版说明在payload/docs/VIDEO_UPLOAD_FIX_20261020.md，安装后也在原项目docs目录。
未对用户的1.4.2原ZIP或Mac/Windows真机实测，接口不匹配会停止。云端样本验证不能替代原151MB视频验证。
'''
for platform,setup,script,extra in [
 ('Mac','安装视频上传补充.command',mac,'macOS_另存兼容视频.command'),
 ('Windows','安装视频上传补充.bat',windows,'Windows_另存兼容视频.bat')]:
 files=common+[extra];manifest=[];items={}
 for name in files:
  data=(root/name).read_bytes()
  if name.endswith('.bat'):data=data.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
  items['payload/'+name]=data
  manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 items['payload/video-fix-manifest.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
 items['install-video-upload-fix.mjs']=(root/'scripts/install-video-upload-fix.mjs').read_bytes()
 items['先读这里.txt']=readme.encode()
 items[setup]=(script if platform=='Mac' else script.replace('\n','\r\n')).encode()
 archive=out/(platform+'_视频上传播放修复补充包_20261020.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in items.items():
   info=zipfile.ZipInfo('hengxiao-video-fix/'+name);info.create_system=3
   info.external_attr=((stat.S_IFREG|(0o755 if name.endswith(('.command','.sh')) else 0o644))<<16)
   info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 print(json.dumps({'file':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},ensure_ascii=False))
