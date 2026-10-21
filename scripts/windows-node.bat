@echo off
set "MEDIA_NODE="
where node >nul 2>nul
if errorlevel 1 goto media_bundled_node
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" >nul 2>nul
if not errorlevel 1 set "MEDIA_NODE=node"
if defined MEDIA_NODE exit /b 0
:media_bundled_node
for %%N in ("%CD%\node.exe" "%CD%\node\node.exe" "%CD%\runtime\node.exe" "%CD%\node\bin\node.exe" "%CD%\.runtime\node.exe") do call :media_probe_node "%%~N"
if defined MEDIA_NODE exit /b 0
echo 未找到Node.js 24.15或更新的24.x。请使用原部署包对应的运行环境。
exit /b 1
:media_probe_node
if defined MEDIA_NODE exit /b 0
if not exist "%~1" exit /b 0
"%~1" -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" >nul 2>nul
if not errorlevel 1 set "MEDIA_NODE=%~1"
exit /b 0
