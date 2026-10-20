#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major!==24||minor<15)throw Error("Node >=24.15 and <25 required")'
node -e 'const p=require("./package.json");if(p.name!=="fenghua-mainland")throw Error("Wrong project: expected fenghua-mainland")'
if test -f package-lock.json; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
npm test
printf '%s\n' 'Website dependencies and fixture tests prepared. Read docs/REPOSITORY_SPLIT_AUDIT.md before building old main. No production configuration or deployment was run.'
