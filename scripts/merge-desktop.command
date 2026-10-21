#!/bin/bash
set -e
transfer_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$transfer_dir"
trap 'transfer_status=$?; if [ "$transfer_status" -ne 0 ]; then echo "生成没有完成，请保留上方报错。原下载文件和原展馆未删除。"; fi; read -r -p "请查看上方结果，按回车关闭。"' EXIT
source "$transfer_dir/transfer-info.sh"
if [ ! -f "$FIRST" ]; then echo '第1段文件缺失，请先将第1包ZIP全部解压。'; exit 1; fi
echo '请选择下载的 Mac 第2段文件，不需要解压第2段。'
second=$(/usr/bin/osascript -e 'POSIX path of (choose file with prompt "选择 Mac 完整部署包的第2段（.part2）文件")') || exit 0
if [ "$(/usr/bin/stat -f %z "$FIRST")" != "$FIRST_BYTES" ] || [ "$(/usr/bin/stat -f %z "$second")" != "$SECOND_BYTES" ]; then
  echo '文件大小不匹配，请确认两段下载完整且选择的是 Mac 第2段。'; exit 1
fi
if [ ! -e "$COMPLETE" ]; then
  echo '正在合并完整部署包，请勿关闭窗口……'
  temporary="$COMPLETE.assembling-$$"
  if ! (set -o noclobber; cat "$FIRST" "$second" > "$temporary"); then exit 1; fi
  actual=$(/usr/bin/shasum -a 256 "$temporary")
  if [ "${actual%% *}" != "$SHA256" ]; then
    rm -f "$temporary"
    echo '完整包校验失败，请重新下载两段。原下载文件已保留。'; exit 1
  fi
  mv -n "$temporary" "$COMPLETE"
else
  actual=$(/usr/bin/shasum -a 256 "$COMPLETE")
  if [ "${actual%% *}" != "$SHA256" ]; then echo '同名完整ZIP已有不同内容，未覆盖。请换一个新文件夹解压第1包后重试。'; exit 1; fi
fi
destination="$transfer_dir/完整部署包"
marker="$destination/.desktop-unpacked-1.4.3"
if [ ! -f "$marker" ]; then
  if [ -e "$destination" ]; then echo '完整部署包目录已存在，但未完成解压。请保留它，换一个新文件夹解压第1包后重试。'; exit 1; fi
  echo '校验通过，正在解压完整程序……'
  /usr/bin/ditto -x -k "$COMPLETE" "$destination"
  printf '%s\n' "$SHA256" > "$marker"
fi
project="$destination/hengxiao-yiyun-1.4.3-desktop"
echo "已完成：$project"
echo '请在新打开的文件夹里双击 macOS_同WiFi扫码启动.command；只在电脑看时双击 macOS_启动.command。'
echo '已有旧data需要迁移时，请在第一次启动新程序之前复制，详见“开始使用.html”。'
/usr/bin/open "$project"
