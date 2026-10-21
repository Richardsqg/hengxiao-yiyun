@echo off
setlocal
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0scripts\windows-crown-ui.ps1" -ImportOnly
set "CROWN_RESULT=%ERRORLEVEL%"
echo.
echo Import exit code: %CROWN_RESULT%
echo Please keep this window open if you need to copy an error message.
pause
exit /b %CROWN_RESULT%
