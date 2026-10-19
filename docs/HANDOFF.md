# 横小艺韵：继续工作与本机查看

更新：2026-10-19（延续2026-10-18整理）。当前桌面版：1.4.2，项目基线：1.4.0。仓库：<https://github.com/Richardsqg/hengxiao-yiyun>。

## 当前首选：1.4.2 Intel Mac / Windows桌面包

[固定版本完整下载](https://github.com/Richardsqg/hengxiao-yiyun/archive/refs/tags/v1.4.2-desktop.zip)，先登录有权限的GitHub账号，完整解压到新文件夹。Intel Mac需macOS13.5及更新，双击 `macOS_一键运行.command`；Windows10/11 x64双击 `Windows_一键运行.bat`。包内已有各自Node24.22运行环境，无需另装浏览器插件、数据库、npm依赖、Homebrew或Xcode。

选1本机或2同Wi-Fi；第一次自己设置后台密码，之后自动打开私有“打开与扫码”面板。备份分别用 `macOS_备份数据.command` / `Windows_备份数据.bat`。业务内容在各自 `data/portable/`，不会提交Git或自动同步到Sites。Mac步骤、系统要求及双击权限备用方法见 [MACOS_GUIDE.md](MACOS_GUIDE.md)，功能维护见 [SOFTWARE_GUIDE.md](SOFTWARE_GUIDE.md)。

这次只补Mac支持和平台提示，保留现有界面、素材及数据隔离。尚未在真实Intel Mac、Windows或手机上进行本轮启动和扫码验收；当前已进行的检查及限制见 [发布记录](PORTABLE_RELEASE.md)。下方旧源码启动方式留作兼容记录，不要求新便携包用户重复安装Node。

## 当前状态与保存位置

这是现有独立版 React/Vite + Node.js HTTP + SQLite 项目，继续保留一套应用与一个仓库。学校 logo、默认凤冠首页、“凤冠360展示”、16:10 文物图列、课程图片前置及最新课程名称均沿用现有实现。

本次开始时，本地 `work` 分支与远程 `main` 都是 `348d83e`，没有未提交修改；上一轮聊天里创建过但未提交的测试启动文件没有出现在当前工作区。本次已将独立测试启动入口重新补入工作分支，后续应以 GitHub 文件为准。

本轮工作分支：`organize/modules-and-handoff-20261018`，已推送并创建 [PR #1](https://github.com/Richardsqg/hengxiao-yiyun/pull/1)，截至2026-10-19交接时尚未合并，GitHub检查显示可以合并。通过此 PR 合并到 `main`。代码、默认素材、构建文件和下列文档一起保存；密码、数据库、后台上传和备份仍保存在本机，不属于 GitHub 仓库。

- [模块说明与文件归属](MODULES.md)：六模块与页面入口。
- [素材实查与缺口](MEDIA_INVENTORY.md)：现有文件和未取得的资料。
- [项目需求及原 Sites 项目](PROJECT_CONTEXT.md)：需求基线与旧站关系。
- [验收记录](ACCEPTANCE.md)：自动检查与待做真机检查。
- [视频压缩方法](VIDEO_COMPRESSION.md)：大附件在电脑上压缩后再上传。

## Windows：从零经验开始查看

1. 合并本次 PR 后，在 GitHub 仓库 `main` 页面点 **Code → Download ZIP**。若暂不合并，可先切到上述工作分支下载。完整解压到一个新文件夹，避免覆盖旧安装的 `data/`。
2. 安装 Node.js **24.x，至少24.15且小于25**。已有符合要求的版本无需重复安装。
3. 双击根目录 **Windows_本机测试.bat**。它只使用 `data/local-preview/`，默认监听 `127.0.0.1:3000`。首次在窗口里设置至少12个字符的管理员密码；网址可直接回车，备案项留空。密码输入时不显示字符，不要把密码写进本说明或发到聊天。
4. 保持启动窗口开启，浏览器会在服务就绪后打开。首页为 <http://127.0.0.1:3000/>，后台为 <http://127.0.0.1:3000/admin>。程序已运行时，直接输入后台网址即可，不必再开一个服务窗口。
5. 正常停止时，在启动窗口按 Ctrl+C。若提示端口占用，先确认旧窗口是否仍在运行。

原 `Windows_启动.bat` 和 `Windows_管理员后台.bat` 默认仍使用 `data/`；它们与新的隔离测试入口用途不同。第一次试用推荐新入口，避免混用旧数据。不要直接双击 `dist/index.html`。

忘记**测试环境**密码：先关闭测试服务，在项目文件夹中打开 PowerShell，执行以下两行；完成后再双击测试启动文件。不要删除数据库。

```powershell
$env:DATA_DIR = "$PWD\data\local-preview"
node scripts/configure.mjs --local
```

配置会更新该测试目录的密码并使旧会话失效，保留留言与素材。正式数据的改密或迁移须另行确认目录并备份。

## macOS / Linux：隔离测试

在完整项目目录内执行：

```sh
export DATA_DIR="$PWD/data/local-preview"
export LOCAL_PREVIEW=1
export PORT=3000
node scripts/configure.mjs --local
node runtime/server.mjs
```

首次设置密码后，以后启动只需设置相同环境变量并运行最后一行；不要每次重复改密码。

## 六个模块入口

以下地址都指程序实际运行的那台电脑。详细维护文件见 MODULES.md。

| 模块 | 页面入口 | 说明 |
| --- | --- | --- |
| 凤冠360展示 | `/` 或 `/crown` | 根入口默认凤冠，保留八展位和实际素材状态 |
| 文化寻根、五门课程 | `/culture` | 三系列、五课程图文 |
| 影像展厅 | `/films` | 第一片已接入用户重传的113秒掐丝珐琅视频 |
| 留言、问卷 | `/voices` | 访客提交，留言仅管理员可查 |
| 管理后台、统计、Excel、内容 | `/admin` | 管理操作与数据需要登录；草稿 `/preview`、展板 `/poster` 也受保护 |
| 公共素材、配置、部署工具 | `/guide`；`dist/assets/`、`scripts/`、`deploy/` | 使用说明可浏览；配置和部署工具不作为公开网页目录暴露 |

独立模块支持直接打开及刷新；浏览器返回可恢复对应模块。公众端保持四个入口，不新增后台导航。新分享链接与分区二维码使用独立路径；旧 `/#culture` 等总入口书签仍按1.4规则默认凤冠。

## 当前云环境能做什么

Codex工作环境的localhost/127.0.0.1不能当成用户电脑的地址。本轮已接手原Sites项目准备发布可点击网页版；发布结果与网页入口见本文件最后的发布记录。本机试用仍按上面的独立测试步骤操作。

没有购买国内服务器或域名，也没有进行国内正式服务器部署。本轮已按PROJECT_CONTEXT.md核对原Sites项目身份与权限，沿用原公开网址更新第一片及模块入口。Sites后台使用原ChatGPT账号认证，本机Node后台使用本机配置密码，两者不同。

## 开发与检查

已有 `dist/` 时，普通查看无需安装开发依赖。修改前端或指定 TypeScript 后端模块后再构建：

```sh
npm ci
npm run build
npm test
```

本轮添加 `package-lock.json` 固定开发依赖。构建保留图片、视频等素材，更新带哈希的 JS 文件；旧哈希构建文件的替换不代表删除业务内容。第二、三片在配置、构建或启动时由仓库内分片还原并校验。已有后台保存的内容优先于内置默认内容，不自动覆盖已有数据。

## 下次从归档聊天继续

1. 打开同一个仓库，先读根目录 AGENTS.md 和本文件，不重新生成产品。
2. 检查 `git status`、当前分支、远程更新，再修改。未推送的提交、未提交文件和本机数据不会因为聊天归档而自动保存到 GitHub。
3. 完成后提交到工作分支并推送，开 PR。GitHub 上进入 **Pull requests**，打开本次 PR，检查 Files changed 后点 **Merge pull request → Confirm merge**；合并后 `main` 才包含修改。
4. 留言、上传、密码配置和完整可恢复备份要另行保存。`npm run backup` 使用当前 DATA_DIR；备份前暂停后台上传。Excel 导出不是完整数据库备份。

## 当前待办

- 已完成新掐丝珐琅视频读取、H.264转码与默认第一片接入；原片和旧导览保留，详见 MEDIA_INVENTORY.md。无需再压缩重传本次视频。
- 补齐凤冠03—08实际作品资料和每件作品的真实环绕序列；现有照片不冒充360实拍。
- 完整字幕、统一片头、历史原始附件和原站生产数据仍按素材清单待补。
- Windows双击、苹果/安卓/微信真机与国内网络验收；当前自动浏览器模拟不能代替这些检查。

## 2026-10-19 本次更新
用户已提供可读取的视频，完成第一片替换及新封面，独立版构建和40项测试通过。接手原Sites公开项目发布网页版，独立入口/浏览器H.264播放已本地验证，托管版40项接口检查和15项缩放/布局检查通过。实际外网直连受当前云环境网络策略限制，尚未做用户所在地访问验证。旧“尚未接入第一片”和“本轮未修改原站”等表述记录的是上一轮交接，当下状态以本节及发布结果为准。

## 网页发布结果（2026-10-19）
Sites第5版已发布成功，原项目及公开访问范围不变。
- 首页：https://fenghua-craft-gallery.aurorafly32.chatgpt.site
- 第一片所在影像展厅：https://fenghua-craft-gallery.aurorafly32.chatgpt.site/films
- 文化寻根 /culture，凤冠 /crown，留言 /voices；后台 /admin 使用原托管站的ChatGPT账号认证。
- 本次发布及素材来源见 [WEB_RELEASE.md](WEB_RELEASE.md)。当前独立GitHub修改继续保存在PR #1工作分支，尚未自动合并main。


## 2026-10-19 最新软件与视频（优先于前述历史记录）
第一片现更新为用户本次29,657,745字节的H.264/AAC、60fps双声道版本，113.150998秒，路径 film-01-qiasi-20261019-v2.mp4。软件保留上传原文件，Sites网页用23,507,490字节托管副本，原帧率、分辨率和音轨保持；此前36秒及上一113秒版本不删除。

独立版升级为1.4.1 Windows x64便携软件，已内置官方Node24.22，双击Windows_一键运行.bat，选本机或同WiFi。独立data/portable和私有扫码面板；本轮47项测试通过。下载和真实验证范围见 [便携软件发布记录](PORTABLE_RELEASE.md)，使用菜单见 [操作指南](SOFTWARE_GUIDE.md)，公网方案见 [访问方案](ACCESS_OPTIONS.md)。未购买服务器或域名、未迁移生产数据，Windows/手机现场真机仍待验证。
