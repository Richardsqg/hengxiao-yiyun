@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call scripts\windows-node.bat
if errorlevel 1 goto pages_end
"%MEDIA_NODE%" scripts\open-desktop-pages.mjs
if not errorlevel 1 exit /b 0
:pages_end
pause
