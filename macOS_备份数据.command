#!/bin/bash
cd "$(dirname "$0")" || exit 1
source scripts/media-node.sh || exit 1
printf '请先停止后台上传。备份保存在本项目backups，请另存一份。\n'
"$MEDIA_NODE" scripts/backup.mjs
media_status=$?
if [ -t 0 ]; then read -r -p '请查看上方结果，按回车关闭。'; fi
exit "$media_status"
