@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 请先从 https://nodejs.org/ 安装 Node.js 24.15 或更高的 24.x 版本，再重新打开本文件。
 pause
 exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]!==24||v[1]<15)process.exit(1)"
if errorlevel 1 (
 echo 请安装 Node.js 24.15 或更高的 24.x 版本。
 pause
 exit /b 1
)
node scripts\compress-video.mjs %*
set "video_compress_exit=%errorlevel%"
pause
exit /b %video_compress_exit%
