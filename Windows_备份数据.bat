@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call scripts\windows-node.bat
if errorlevel 1 goto backup_end
echo 请先停止后台上传。备份将保存在本项目backups文件夹，请另存一份。
"%MEDIA_NODE%" scripts\backup.mjs
:backup_end
pause
