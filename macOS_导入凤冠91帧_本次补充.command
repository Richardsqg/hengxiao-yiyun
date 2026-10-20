#!/bin/bash
cd "$(dirname "$0")" || exit 1
source scripts/media-node.sh || exit 1
media_archive="${1:-}"
if [ -z "$media_archive" ]; then
  media_archive=$(/usr/bin/osascript -e 'POSIX path of (choose file with prompt "请选择原来的凤冠360_网页轻量包_91帧.zip，不必重新下载图片")') || exit 0
fi
"$MEDIA_NODE" scripts/import-crown-zip.mjs "$media_archive"
media_status=$?
read -r -p '按回车关闭。'
exit "$media_status"
