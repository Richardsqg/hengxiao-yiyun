#!/bin/bash
cd "$(dirname "$0")" || exit 1
source scripts/media-node.sh || exit 1
video_input="${1:-}"
if [ -z "$video_input" ]; then
  video_input=$(/usr/bin/osascript -e 'POSIX path of (choose file with prompt "选择有声无画面或无法上传的原视频，将另存兼容版，不覆盖原片")') || exit 0
fi
"$MEDIA_NODE" scripts/repair-video.mjs "$video_input"
video_status=$?
read -r -p '按回车关闭。'
exit "$video_status"
