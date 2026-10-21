#!/bin/bash
# Sourced by the additional Mac launchers; no downloads or package installation.
MEDIA_NODE=''
if command -v node >/dev/null 2>&1; then MEDIA_NODE="$(command -v node)"; fi
media_cpu="$(uname -m)"
if [ "$media_cpu" = 'x86_64' ]; then media_cpu='x64'; fi
for media_candidate in "$PWD/.runtime/darwin-$media_cpu/bin/node" "$PWD/node/bin/node" "$PWD/.runtime/node/bin/node" "$PWD/runtime/node" "$PWD/node" "$PWD/vendor/node/bin/node" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -x "$media_candidate" ] && [ ! -d "$media_candidate" ]; then
    if "$media_candidate" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then MEDIA_NODE="$media_candidate"; break; fi
  fi
done
if [ -z "$MEDIA_NODE" ] || ! "$MEDIA_NODE" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then
  if [ -f "$PWD/.runtime/darwin-$media_cpu/bin/node" ]; then
    echo '包内Node未能运行，具体系统提示如下：'
    "$PWD/.runtime/darwin-$media_cpu/bin/node" --version
    echo '请确认macOS为13.5及以上，并按macOS权限提示允许运行。保留上方完整报错。'
  else
    echo '未找到 Node.js 24.15 或更新的24.x。完整部署包请全部解压并保留.runtime文件夹；源码/旧包可安装对应版本。'
  fi
  read -r -p '按回车关闭。'
  exit 1
fi
