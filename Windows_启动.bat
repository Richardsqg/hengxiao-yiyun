@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 请先从 https://nodejs.org/ 安装 Node.js 24 LTS，再重新打开本文件。
 pause
 exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]!==24||v[1]<15)process.exit(1)"
if errorlevel 1 (
 echo 请安装 Node.js 24.15 或更高的 24.x LTS 版本。
 pause
 exit /b 1
)
set "LOCAL_PREVIEW=1"
set "HOST=127.0.0.1"
set "PORT=3000"
if not defined DATA_DIR set "DATA_DIR=%~dp0data"
if not exist "%DATA_DIR%\config.json" node scripts\configure.mjs --local
if not exist "%DATA_DIR%\config.json" (
 pause
 exit /b 1
)
echo 展馆：http://127.0.0.1:3000/
echo 管理员后台：http://127.0.0.1:3000/admin
echo 服务就绪后会自动打开浏览器。请保持此窗口开启。
node runtime\server.mjs --open-browser %*
pause
