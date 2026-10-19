#!/bin/bash
# 由根目录的 macOS .command 启动文件载入；兼容系统自带 Bash 3.2。

yiyun_pause() {
  if [ -t 0 ] && [ -t 1 ]; then
    printf '\n按回车键关闭此窗口。'
    read -r YIYUN_PAUSE_REPLY
  fi
}

yiyun_check_node() {
  local yiyun_version
  yiyun_version="$("$YIYUN_NODE" -p 'process.versions.node' 2>/dev/null)" || {
    printf '运行程序无法在这台 Mac 上启动。需要 macOS 13.5 或更高版本及匹配的芯片架构；或安装兼容的 Node.js 24.15 及以上的 24.x（低于25）。\n' >&2
    return 1
  }
  if ! "$YIYUN_NODE" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major===24&&minor>=15?0:1)' >/dev/null 2>&1; then
    printf '当前 Node.js 为 %s；需要 24.15 及以上的 24.x，且低于25。\n' "$yiyun_version" >&2
    return 1
  fi
}

yiyun_use_macos_node() {
  local yiyun_root="$1"
  local yiyun_arch yiyun_archive_name yiyun_package_root yiyun_archive yiyun_manifest
  local yiyun_expected yiyun_actual yiyun_hash_line yiyun_cache yiyun_staging yiyun_cached_hash
  local yiyun_system_version yiyun_system_major yiyun_system_minor
  if [ "$(uname -s)" != Darwin ]; then
    printf '此启动文件用于 macOS；Windows 请使用 Windows_一键运行.bat。\n' >&2
    return 1
  fi
  if command -v sw_vers >/dev/null 2>&1; then
    yiyun_system_version="$(sw_vers -productVersion 2>/dev/null)" || return 1
    yiyun_system_major="${yiyun_system_version%%.*}"
    yiyun_system_minor="${yiyun_system_version#*.}"
    yiyun_system_minor="${yiyun_system_minor%%.*}"
    case "$yiyun_system_major:$yiyun_system_minor" in
      *[!0-9:]*|:*|*:) printf '无法识别 macOS 版本，需要 macOS 13.5 或更高版本。\n' >&2; return 1 ;;
    esac
    if [ "$yiyun_system_major" -lt 13 ] || { [ "$yiyun_system_major" -eq 13 ] && [ "$yiyun_system_minor" -lt 5 ]; }; then
      printf '当前系统为 macOS %s；本软件需要 macOS 13.5 或更高版本，请先升级系统。不会自动改用旧版 Node.js。\n' "$yiyun_system_version" >&2
      return 1
    fi
  fi
  case "$(uname -m)" in
    arm64) yiyun_arch=arm64 ;;
    x86_64) yiyun_arch=x64 ;;
    *) printf '暂不支持这台 Mac 的芯片架构，请使用 Apple 芯片或 Intel 64 位 Mac。\n' >&2; return 1 ;;
  esac
  yiyun_package_root="node-v24.22.0-darwin-$yiyun_arch"
  yiyun_archive_name="$yiyun_package_root.tar.gz"
  yiyun_archive="$yiyun_root/runtime/macos/$yiyun_archive_name"
  yiyun_manifest="$yiyun_root/runtime/macos/SHASUMS256.txt"
  if [ ! -f "$yiyun_archive" ]; then
    if command -v node >/dev/null 2>&1; then
      YIYUN_NODE="$(command -v node)"
      printf '未包含本机架构的便携运行包，将检查已安装的 Node.js。\n'
      yiyun_check_node
      return $?
    fi
    printf '没有找到内置运行包：%s\n请完整解压 Mac 软件包，或从 https://nodejs.org/ 安装适合本机的 Node.js 24.15 及以上的 24.x（低于25）。\n无需 Homebrew、Xcode 或浏览器插件。\n' "$yiyun_archive_name" >&2
    return 1
  fi
  if [ ! -f "$yiyun_manifest" ] || ! command -v shasum >/dev/null 2>&1; then
    printf '内置运行包的 SHA-256 校验文件或 macOS shasum 工具缺失，请重新完整解压软件包。\n' >&2
    return 1
  fi
  yiyun_expected="$(awk -v archive="$yiyun_archive_name" '$2 == archive || $2 == "*" archive { print $1; exit }' "$yiyun_manifest")"
  case "$yiyun_expected" in
    ''|*[!0-9a-fA-F]*) printf 'SHA-256 清单缺少本机架构的有效校验值。请重新完整解压软件包。\n' >&2; return 1 ;;
  esac
  if [ "${#yiyun_expected}" -ne 64 ]; then
    printf 'SHA-256 校验值长度不正确，请重新完整解压软件包。\n' >&2
    return 1
  fi
  yiyun_hash_line="$(shasum -a 256 "$yiyun_archive")" || return 1
  yiyun_actual="${yiyun_hash_line%% *}"
  if [ "$yiyun_actual" != "$yiyun_expected" ]; then
    printf '内置 Node.js 运行包校验失败，文件可能未完整解压。已停止启动，请重新下载并完整解压软件包。\n' >&2
    return 1
  fi
  yiyun_cache="$yiyun_root/runtime/macos/.extracted/$yiyun_arch"
  if [ ! -e "$yiyun_cache" ]; then
    mkdir -p "$yiyun_root/runtime/macos/.extracted" || return 1
    yiyun_staging="$(mktemp -d "$yiyun_root/runtime/macos/.extracted/.$yiyun_arch.XXXXXX")" || return 1
    printf '首次运行，正在解压本机架构的 Node.js（不需要联网）。\n'
    if ! tar -xzf "$yiyun_archive" -C "$yiyun_staging" "$yiyun_package_root/bin/node" "$yiyun_package_root/LICENSE"; then
      rm -rf "$yiyun_staging"
      printf '内置运行程序解压失败，请检查剩余磁盘空间并重新完整解压软件包。\n' >&2
      return 1
    fi
    yiyun_hash_line="$(shasum -a 256 "$yiyun_staging/$yiyun_package_root/bin/node")" || { rm -rf "$yiyun_staging"; return 1; }
    printf '%s\n' "$yiyun_expected" > "$yiyun_staging/$yiyun_package_root/.archive-sha256" || { rm -rf "$yiyun_staging"; return 1; }
    printf '%s\n' "${yiyun_hash_line%% *}" > "$yiyun_staging/$yiyun_package_root/.node-sha256" || { rm -rf "$yiyun_staging"; return 1; }
    if ! mv "$yiyun_staging/$yiyun_package_root" "$yiyun_cache"; then
      rm -rf "$yiyun_staging"
      return 1
    fi
    rmdir "$yiyun_staging" || return 1
  fi
  if [ ! -f "$yiyun_cache/.archive-sha256" ] || [ "$(cat "$yiyun_cache/.archive-sha256")" != "$yiyun_expected" ] || [ ! -x "$yiyun_cache/bin/node" ] || [ ! -f "$yiyun_cache/.node-sha256" ]; then
    printf '运行缓存不完整或与内置包不符。请先将 runtime/macos/.extracted/%s 文件夹改名保留，再重新启动；data/portable 中的内容不受影响。\n' "$yiyun_arch" >&2
    return 1
  fi
  yiyun_cached_hash="$(cat "$yiyun_cache/.node-sha256")"
  yiyun_hash_line="$(shasum -a 256 "$yiyun_cache/bin/node")" || return 1
  if [ "${yiyun_hash_line%% *}" != "$yiyun_cached_hash" ]; then
    printf '已解压的运行程序校验失败。请先将 runtime/macos/.extracted/%s 文件夹改名保留，再重新启动。\n' "$yiyun_arch" >&2
    return 1
  fi
  YIYUN_NODE="$yiyun_cache/bin/node"
  yiyun_check_node
}
