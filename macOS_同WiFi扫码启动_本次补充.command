#!/bin/bash
cd "$(dirname "$0")" || exit 1
source scripts/media-node.sh || exit 1
"$MEDIA_NODE" scripts/start-media-supplement.mjs --lan
media_status=$?
if [ "$media_status" -ne 0 ]; then read -r -p '请查看上方提示，按回车关闭。'; fi
exit "$media_status"
