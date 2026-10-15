@echo off
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
if not exist data\config.json node scripts\configure.mjs
if not exist data\config.json (
 pause
 exit /b 1
)
echo 本机测试请在浏览器打开 http://localhost:3000 。请保持此窗口开启。
node runtime\server.mjs
pause
