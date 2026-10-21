@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call scripts\windows-node.bat
if errorlevel 1 goto desktop_end
"%MEDIA_NODE%" scripts\start-media-supplement.mjs --local %*
:desktop_end
pause
