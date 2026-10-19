@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "YIYUN_NODE=%~dp0runtime\node.exe"
if exist "%YIYUN_NODE%" goto launch
where node >nul 2>nul
if errorlevel 1 (
 echo 未找到软件自带的运行程序 runtime\node.exe。
 echo 请完整解压Windows便携软件包，或安装Node.js 24.15及以上的24.x版本。
 pause
 exit /b 1
)
set "YIYUN_NODE=node"
:launch
"%YIYUN_NODE%" scripts\launch.mjs %*
pause
