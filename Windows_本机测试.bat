@echo off
setlocal
chcp 65001 >nul
set "DATA_DIR=%~dp0data\local-preview"
call "%~dp0Windows_启动.bat" %*
