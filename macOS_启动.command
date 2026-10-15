#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo '请先从 https://nodejs.org/ 安装 Node.js 24 LTS。'; read -r; exit 1; fi
node -e 'const v=process.versions.node.split(".").map(Number);if(v[0]!==24||v[1]<15)process.exit(1)' || { echo '需要 Node.js 24.15 或更高的 24.x LTS。'; read -r; exit 1; }
if [ ! -f data/config.json ]; then node scripts/configure.mjs || exit 1; fi
echo '本机测试请在浏览器打开 http://localhost:3000 。请保持此窗口开启。'
node runtime/server.mjs
