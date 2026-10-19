#!/bin/bash
YIYUN_ROOT="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
if [ ! -f "$YIYUN_ROOT/scripts/macos-runtime.sh" ]; then
  printf '缺少运行辅助文件，请完整解压横小艺韵软件包。\n' >&2
  exit 1
fi
. "$YIYUN_ROOT/scripts/macos-runtime.sh"
cd "$YIYUN_ROOT" || exit 1
if yiyun_use_macos_node "$YIYUN_ROOT"; then
  "$YIYUN_NODE" "$YIYUN_ROOT/scripts/launch.mjs" "$@"
  YIYUN_STATUS=$?
else
  YIYUN_STATUS=$?
fi
yiyun_pause
exit "$YIYUN_STATUS"
