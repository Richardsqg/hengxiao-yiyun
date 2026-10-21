param(
    [string]$PackageRoot,
    [switch]$ImportOnly
)

$ErrorActionPreference = 'Stop'
$logFile = Join-Path ([System.IO.Path]::GetTempPath()) ('Hengxiao-Crown360-' + [guid]::NewGuid().ToString('N') + '.log')
$logAvailable = $false

function Write-Status([string]$Message) {
    Write-Host $Message
    if ($script:logAvailable) {
        try { Add-Content -LiteralPath $script:logFile -Value $Message -Encoding UTF8 }
        catch { $script:logAvailable = $false }
    }
}

function Select-CrownFolder([string]$Title) {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $Title
    $dialog.ShowNewFolderButton = $false
    try {
        $result = $dialog.ShowDialog()
        if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
        return $dialog.SelectedPath
    } finally { $dialog.Dispose() }
}

function Find-CrownNode([string]$Project) {
    $candidates = @(
        (Join-Path $Project 'node.exe'),
        (Join-Path $Project 'node\node.exe'),
        (Join-Path $Project 'runtime\node.exe'),
        (Join-Path $Project 'node\bin\node.exe'),
        (Join-Path $Project '.runtime\node.exe')
    )
    $globalNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($globalNode) { $candidates += $globalNode[0].Source }
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            & $candidate -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24&&v[1]>=15?0:1)" *> $null
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch { continue }
    }
    throw '未找到 Node.js 24.15 或更新的 24.x。请保留本窗口和日志，核对原部署包的 Node 运行环境。'
}

function Invoke-CrownNode([string]$Node, [string[]]$NodeArguments) {
    Write-Status ('执行：' + $NodeArguments[0])
    $output = & $Node @NodeArguments 2>&1
    $status = $LASTEXITCODE
    foreach ($line in $output) { Write-Status ([string]$line) }
    return [int]$status
}

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    try {
        Set-Content -LiteralPath $logFile -Value '横小艺韵 Windows 360 v2 安装日志' -Encoding UTF8
        $logAvailable = $true
    } catch { Write-Host '无法创建临时日志，请保留本窗口的提示。' }
    Write-Status ('日志位置：' + $logFile)
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::EnableVisualStyles()
    if ($ImportOnly) {
        $project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    } else {
        Write-Status '第一步：请在弹窗里选择原项目文件夹。打开该文件夹后应能看到 package.json、runtime、dist。'
        $project = Select-CrownFolder '选择原展馆项目文件夹：里面应有 package.json、runtime、dist'
        if (-not $project) { Write-Status '已取消选择，尚未安装。'; exit 0 }
    }
    Write-Status ('原项目：' + $project)
    if (-not (Test-Path -LiteralPath (Join-Path $project 'package.json') -PathType Leaf)) {
        throw '所选文件夹里没有 package.json。请打开原部署包，继续找到含 package.json、runtime、dist 的项目文件夹。'
    }
    $node = Find-CrownNode $project
    Write-Status ('Node：' + $node)
    $needsFrames = $true
    if (-not $ImportOnly) {
        if (-not $PackageRoot) { throw '没有找到添加包根目录。请先全部解压添加包，再双击安装入口。' }
        $status = Invoke-CrownNode $node @((Join-Path $PackageRoot 'apply-media-package.mjs'), $project, (Join-Path $PackageRoot 'payload'))
        if ($status -ne 0 -and $status -ne 10) { throw ('补充文件安装未完成，退出码：' + $status) }
        $needsFrames = ($status -eq 10)
    }
    if ($needsFrames) {
        Write-Status '第二步：请先解压原凤冠91帧 ZIP，再在弹窗中选择 frames 文件夹。'
        $frames = Select-CrownFolder '选择原凤冠 ZIP 解压后的 frames 文件夹：里面应有 frame_001.webp 至 frame_091.webp'
        if (-not $frames) {
            Write-Status '已取消图片导入。以后可用原项目新增的 Windows_导入凤冠91帧_本次补充.bat 继续。'
            exit 0
        }
        Write-Status ('素材文件夹：' + $frames)
        $status = Invoke-CrownNode $node @((Join-Path $project 'scripts\import-crown-folder.mjs'), $frames)
        if ($status -ne 0) { throw ('图片导入未完成，退出码：' + $status) }
    }
    Write-Status '第一组凤冠360添加已完成。请用原 Windows 启动入口重启展馆，并按 Ctrl+F5 刷新网页。'
    Write-Status '安装器未改写原密码、留言或已上传视频。'
    exit 0
} catch {
    Write-Status ('安装未完成：' + $_.Exception.Message)
    Write-Status '请复制本窗口的报错或保留日志。先不要删除、移动原项目里的文件。'
    Write-Status ('日志位置：' + $logFile)
    exit 1
}
