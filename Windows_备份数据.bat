@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "DATA_DIR=%~dp0data\portable"
if not exist "%DATA_DIR%\config.json" (
 echo 请先运行 Windows_一键运行.bat 完成首次配置。
 pause
 exit /b 1
)
set "YIYUN_NODE=%~dp0runtime\node.exe"
if not exist "%YIYUN_NODE%" set "YIYUN_NODE=node"
echo 请先暂停后台上传。备份完成后，请将 backups 文件夹中的副本复制到另一台设备保存。
pause
"%YIYUN_NODE%" scripts\backup.mjs
pause
