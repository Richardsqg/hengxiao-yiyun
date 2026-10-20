@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "VIDEO_INPUT=%~1"
if not defined VIDEO_INPUT set /p "VIDEO_INPUT=请把原视频拖入此窗口并按回车："
set "VIDEO_INPUT=%VIDEO_INPUT:"=%"
node scripts\repair-video.mjs "%VIDEO_INPUT%"
pause
