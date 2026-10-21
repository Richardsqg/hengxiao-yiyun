@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call scripts\windows-node.bat
if errorlevel 1 goto crown_failed
set "CROWN_FOLDER=%~1"
if not defined CROWN_FOLDER (
 echo 请将凤冠ZIP解压后的frames文件夹拖入本窗口，然后按回车。
 set /p "CROWN_FOLDER=图片文件夹："
)
set "CROWN_FOLDER=%CROWN_FOLDER:"=%"
"%MEDIA_NODE%" scripts\import-crown-folder.mjs "%CROWN_FOLDER%"
if errorlevel 1 goto crown_failed
echo 导入已完成。请使用原Windows启动入口重新运行展馆。
pause
exit /b 0
:crown_failed
echo 导入没有完成，请查看上方提示。原密码和留言未由导入器改写。
pause
exit /b 1
