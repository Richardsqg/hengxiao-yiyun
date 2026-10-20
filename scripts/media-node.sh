#!/bin/bash
# Sourced by the additional Mac launchers; no downloads or package installation.
MEDIA_NODE=''
if command -v node >/dev/null 2>&1; then MEDIA_NODE="$(command -v node)"; fi
for media_candidate in "$PWD/node/bin/node" "$PWD/.runtime/node/bin/node" "$PWD/runtime/node" "$PWD/node" "$PWD/vendor/node/bin/node" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -x "$media_candidate" ] && [ ! -d "$media_candidate" ]; then
    if "$media_candidate" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then MEDIA_NODE="$media_candidate"; break; fi
  fi
done
if [ -z "$MEDIA_NODE" ] || ! "$MEDIA_NODE" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then
  echo '未找到 Node.js 24.15 或更新的24.x。请使用原包的Node运行环境，或安装对应版本。无需重新下载网页。'
  read -r -p '按回车关闭。'
  exit 1
fi
