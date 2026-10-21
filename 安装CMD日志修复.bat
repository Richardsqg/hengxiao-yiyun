@echo off
setlocal
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-hotfix.ps1"
set "FIX_STATUS=%ERRORLEVEL%"
pause
exit /b %FIX_STATUS%
