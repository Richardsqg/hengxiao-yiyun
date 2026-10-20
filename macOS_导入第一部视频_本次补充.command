#!/bin/bash
cd "$(dirname "$0")" || exit 1
source scripts/media-node.sh || exit 1
media_video="${1:-}"
if [ -z "$media_video" ]; then
  media_video=$(/usr/bin/osascript -e 'POSIX path of (choose file with prompt "请选择从掐丝珐琅ZIP解压出的MP4视频，不要选择ZIP")') || exit 0
fi
"$MEDIA_NODE" scripts/import-first-video.mjs "$media_video"
media_status=$?
read -r -p '按回车关闭。'
exit "$media_status"
