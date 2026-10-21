#!/bin/bash
YIYUN_FIX_ROOT="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
yiyun_pause(){ if [ -t 0 ]; then printf '\n按回车关闭。'; read -r YIYUN_REPLY; fi; }
printf '请先在原展馆窗口按Control+C停止服务。\n'
if [ "$#" -gt 0 ]; then YIYUN_PROJECT="$1"
else YIYUN_PROJECT="$(osascript -e 'POSIX path of (choose folder with prompt "选择原1.4.3项目文件夹，里面应有package.json、runtime、dist")')" || { printf '已取消选择。\n'; yiyun_pause; exit 0; }; fi
YIYUN_ARCH=x64
if [ "$(uname -m)" = arm64 ]; then YIYUN_ARCH=arm64; fi
YIYUN_NODE="$YIYUN_PROJECT/.runtime/darwin-$YIYUN_ARCH/bin/node"
if [ ! -x "$YIYUN_NODE" ]; then YIYUN_NODE="$(command -v node)"; fi
if [ -z "$YIYUN_NODE" ] || ! "$YIYUN_NODE" -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)' >/dev/null 2>&1; then
 printf '找不到可运行的Node24，请选择完整项目并保留隐藏的.runtime文件夹；Mac需macOS13.5或更新。\n'; yiyun_pause; exit 1
fi
"$YIYUN_NODE" "$YIYUN_FIX_ROOT/install-device-fix.mjs" "$YIYUN_PROJECT" "$YIYUN_FIX_ROOT/payload"
YIYUN_STATUS=$?
yiyun_pause
exit "$YIYUN_STATUS"
