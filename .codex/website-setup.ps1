$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major!==24||minor<15)throw Error("Node >=24.15 and <25 required")'
if ($LASTEXITCODE -ne 0) { throw 'Wrong Node version' }
node -e 'const p=require("./package.json");if(p.name!=="fenghua-mainland")throw Error("Wrong project")'
if ($LASTEXITCODE -ne 0) { throw 'Wrong repository' }
if (Test-Path -LiteralPath package-lock.json) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Website tests failed' }
Write-Host 'Read docs/REPOSITORY_SPLIT_AUDIT.md before building old main. No production configuration or deployment was run.'
