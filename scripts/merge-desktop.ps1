param()
$ErrorActionPreference = 'Stop'
$temporary = $null
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'transfer-info.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $first = Join-Path $PSScriptRoot $manifest.first
    if (-not (Test-Path -LiteralPath $first -PathType Leaf)) { throw '第1段文件不完整，请先将第1包ZIP全部解压后再运行。' }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    Write-Host '请在弹窗里选择下载的第2段文件，不需要解压第2段。'
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = '选择 Windows 完整部署包的第2段文件'
    $dialog.Filter = '第2段文件 (*.part2)|*.part2|所有文件 (*.*)|*.*'
    $dialog.FileName = $manifest.second
    try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Host '已取消，原文件保留。'; exit 0 }
        $second = $dialog.FileName
    } finally { $dialog.Dispose() }
    if ((Get-Item -LiteralPath $first).Length -ne $manifest.firstBytes -or (Get-Item -LiteralPath $second).Length -ne $manifest.secondBytes) {
        throw '所选文件大小与本系统的第2段不一致。请确认下载完整且选择的是 Windows 第2段。'
    }
    $complete = Join-Path $PSScriptRoot $manifest.complete
    if (-not (Test-Path -LiteralPath $complete)) {
        $temporary = $complete + '.assembling-' + [guid]::NewGuid().ToString('N')
        Write-Host '正在合并完整部署包，请勿关闭窗口……'
        $target = [System.IO.File]::Open($temporary, [System.IO.FileMode]::CreateNew)
        try {
            foreach ($part in @($first, $second)) {
                $source = [System.IO.File]::OpenRead($part)
                try { $source.CopyTo($target) } finally { $source.Dispose() }
            }
        } finally { $target.Dispose() }
        if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256) {
            throw '完整包校验失败，请重新下载两段；已保留原下载文件。'
        }
        Move-Item -LiteralPath $temporary -Destination $complete
        $temporary = $null
    } elseif ((Get-FileHash -LiteralPath $complete -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256) {
        throw '同名完整ZIP已有不同内容，未覆盖。请换一个新文件夹解压第1包后重试。'
    }
    $destination = Join-Path $PSScriptRoot '完整部署包'
    $marker = Join-Path $destination '.desktop-unpacked-1.4.3'
    if (-not (Test-Path -LiteralPath $marker)) {
        if (Test-Path -LiteralPath $destination) { throw '完整部署包目录已存在，但未完成解压。请保留它，换一个新文件夹解压第1包后重试。' }
        Write-Host '校验通过，正在解压完整程序……'
        Expand-Archive -LiteralPath $complete -DestinationPath $destination
        Set-Content -LiteralPath $marker -Value $manifest.sha256 -Encoding ASCII
    }
    $project = Join-Path $destination 'hengxiao-yiyun-1.4.3-desktop'
    Write-Host ('已完成：' + $project)
    Write-Host '请在新打开的文件夹里，双击 Windows_同WiFi扫码启动.bat；只在电脑看时双击 Windows_启动.bat。'
    Write-Host '已有旧data需要迁移时，请在第一次启动新程序之前复制，详见“开始使用.html”。'
    Invoke-Item -LiteralPath $project
    exit 0
} catch {
    Write-Host ('生成未完成：' + $_.Exception.Message)
    if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary }
    Write-Host '请保留本窗口的完整报错；原项目与原下载文件未删除。'
    exit 1
}
