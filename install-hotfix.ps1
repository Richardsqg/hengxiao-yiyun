$ErrorActionPreference = 'Stop'
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    Add-Type -AssemblyName System.Windows.Forms
    Write-Host '先在展馆黑色窗口按Ctrl+C停止服务，再选择含package.json、runtime、dist的1.4.3项目文件夹。'
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = '选择原1.4.3项目文件夹（不是data或runtime子目录）'
    $dialog.ShowNewFolderButton = $false
    try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
        $project = $dialog.SelectedPath
    } finally { $dialog.Dispose() }
    $arch = 'x64'
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { $arch = 'arm64' }
    $candidates = @((Join-Path $project ('.runtime\win-' + $arch + '\node.exe')), (Join-Path $project 'runtime\node.exe'), (Join-Path $project 'node.exe'))
    $globalNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($globalNode) { $candidates += $globalNode[0].Source }
    $node = $null
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        & $candidate -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" *> $null
        if ($LASTEXITCODE -eq 0) { $node = $candidate; break }
    }
    if (-not $node) { throw '未找到Node24运行环境，请保留完整部署包内隐藏的.runtime文件夹。' }
    & $node (Join-Path $PSScriptRoot 'install-desktop-hotfix.mjs') $project (Join-Path $PSScriptRoot 'payload')
    exit $LASTEXITCODE
} catch { Write-Host ('修复未完成：' + $_.Exception.Message); exit 1 }
