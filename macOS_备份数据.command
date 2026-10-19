#!/bin/bash
YIYUN_ROOT="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
if [ ! -f "$YIYUN_ROOT/scripts/macos-runtime.sh" ]; then
  printf '缺少运行辅助文件，请完整解压横小艺韵软件包。\n' >&2
  exit 1
fi
. "$YIYUN_ROOT/scripts/macos-runtime.sh"
cd "$YIYUN_ROOT" || exit 1
export DATA_DIR="$YIYUN_ROOT/data/portable"
if [ ! -f "$DATA_DIR/config.json" ]; then
  printf '请先运行 macOS_一键运行.command 完成首次配置。\n' >&2
  yiyun_pause
  exit 1
fi
if ! yiyun_use_macos_node "$YIYUN_ROOT"; then
  yiyun_pause
  exit 1
fi
printf '请先暂停后台上传。备份当前 data/portable，完成后将 backups 中的副本复制到另一台设备保存。\n'
if [ -t 0 ] && [ -t 1 ]; then
  printf '确认已经暂停后台上传后，按回车开始备份。'
  read -r YIYUN_BACKUP_REPLY
fi
"$YIYUN_NODE" "$YIYUN_ROOT/scripts/backup.mjs" "$@"
YIYUN_STATUS=$?
yiyun_pause
exit "$YIYUN_STATUS"
