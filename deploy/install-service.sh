#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo '请用 sudo bash deploy/install-service.sh 运行。'; exit 1; fi
cd /opt/fenghua
if [ ! -f data/config.json ]; then echo '请先运行 node scripts/configure.mjs。'; exit 1; fi
FENGHUA_NODE="$(command -v node)"
case "$FENGHUA_NODE" in /usr/bin/node|/usr/local/bin/node) ;; *) echo '请把 Node.js 安装到 /usr/bin/node 或 /usr/local/bin/node。'; exit 1;; esac
"$FENGHUA_NODE" -e 'const v=process.versions.node.split(".").map(Number);if(v[0]!==24||v[1]<15)process.exit(1)'
if ! id fenghua >/dev/null 2>&1; then useradd --system --home-dir /opt/fenghua --shell /usr/sbin/nologin fenghua; fi
chown -R fenghua:fenghua data
chmod 700 data
chmod 600 data/config.json
if [ -f /etc/systemd/system/fenghua.service ]; then cp /etc/systemd/system/fenghua.service "/etc/systemd/system/fenghua.service.backup-$(date +%Y%m%d%H%M%S)"; fi
sed "s|/usr/bin/node|$FENGHUA_NODE|" deploy/fenghua.service > /etc/systemd/system/fenghua.service
systemctl daemon-reload
systemctl enable --now fenghua
systemctl restart fenghua
echo '展馆后台服务已启动。接下来配置 Caddy 和域名 HTTPS。'
