# 两个独立项目的 Codex 操作指南

日期：2026-10-20。仓库是保存代码和提交历史的地方；环境是运行代码时的工具、依赖和设置。ChatGPT 聊天项目只是组织聊天，不能代替 GitHub 仓库隔离。

## 固定对应关系

| 用途 | GitHub 仓库 | 建议环境名 |
| --- | --- | --- |
| 凤华匠彩／横小艺韵／掐丝珐琅网站 | Richardsqg/hengxiao-yiyun | fenghua-website |
| 京东定时助手 | Richardsqg/jd-helper | jd-helper |

每个环境只选择对应的一个仓库。不要在原网站聊天里继续开发京东助手；旧聊天可能仍指向旧文件系统。

## 网页或电脑建立云端环境

1. 新建 Codex 任务，选择 Work in（工作位置）→ Cloud（云端）。
2. 打开 Select environment → Create environment。也可从 Settings → Codex Cloud → Environments → Create environment 进入。
3. 只勾选对应仓库。如果 jd-helper 不出现，在 GitHub 连接的仓库授权中添加该私有仓库，再刷新。
4. 选择 Get started，要求使用 Node.js 24。京东仓库运行 scripts/codex-setup.sh；网站依据所选分支的 package.json 与锁文件安装依赖。
5. 京东测试：npm run typecheck、npm run build；将 JDH_TEST_BROWSER 指向环境内 Chromium，再运行 npm test。云端不需要京东账号、Cookie 或支付密码，也不启动真实定时任务。
6. 网站 main 是较旧的 1.4 基线；较新完整桌面版在 organize/modules-and-handoff-20261018 和 PR #1。先决定开发基线，不能把旧 main 当作最新版本。main 没有 package-lock.json，使用 npm install；较新分支有锁文件，使用 npm ci。Node 版本要求 >=24.15 且 <25。网站 npm test 用临时数据；不要在环境安装时执行交互式 configure 或正式部署脚本。
7. 检查安装和验证报告，保存配置，再点击 Publish（发布环境）。看到 Environment published 后再开始新任务。未发布的草稿不能视为配置完成。
8. 分别建立并发布两个环境。环境发布不等于网站上线；腾讯云、域名、Sites 仍是另一个部署步骤。

## iPhone 后续开发

1. 使用同一 ChatGPT 账号，打开 Codex。
2. 选择已经发布的 fenghua-website 或 jd-helper 环境，再发送任务。当前官方说明将新环境创建入口放在网页和桌面；手机找不到创建入口时，先在网页或电脑创建。
3. 发送前检查环境对应的仓库。第一条消息可写：“只在 Richardsqg/jd-helper 中工作。先报告仓库、当前分支、提交，再读 AGENTS.md；不要修改网站仓库。”网站任务则替换成 hengxiao-yiyun。
4. 手机发出任务后，检查改动和验证结果，再创建或合并 PR。聊天中的‘完成’不等于代码已经合并到 main。
5. 切换项目时开新任务并重新选环境；不要只在旧任务里说‘开始新项目’。

## 电脑本地开发

1. 将两个私有仓库分别克隆到同级目录，例如 C:\Projects\hengxiao-yiyun 和 C:\Projects\jd-helper。不要互相嵌套，也不要把同一个目录换名字后当另一个项目。
2. 在 Codex 添加／打开本地项目时，选择包含 package.json 和 AGENTS.md 的仓库根目录。分别添加两个项目。
3. 每次开始先让 Codex 报告 git remote -v、git branch --show-current、git status --short。确认 origin 与本次项目一致。
4. 京东：安装 Node.js 24，运行 powershell -File scripts/codex-setup.ps1。浏览器测试将 JDH_TEST_BROWSER 设置为本机 Edge 路径，再运行 npm test。需要 Electron 窗口时另安装 Electron 二进制：node node_modules/electron/install.js，然后 npm start。
5. 网站：按选定分支安装依赖、构建、运行 npm test；首次使用独立版后台时才由本人运行 npm run configure 设置密码。保留 data/ 与 backups/，不提交 Git。
6. 在桌面设置的 Local environments 中填写安装脚本与常用操作；Codex 会在项目根目录 .codex 中生成配置。可以将生成的配置提交到各自仓库；不要手写未经版本核实的配置格式。
7. 日常为每项改动开分支；完成后提交、推送、审查 PR。另一个项目开另一个聊天。手机云端与电脑本地通过已提交并推送的代码同步，未提交文件不会自动同步。

## 今后建立第三个新项目

先在 GitHub 新建独立私有仓库并初始化 README，再授权 Codex 访问；创建只绑定这个仓库的新云端环境。电脑端则先独立克隆并添加本地项目。给新项目自己的 AGENTS.md、依赖锁文件、测试命令和环境变量清单，再提出开发需求。不要选择旧项目环境来生成另一个产品。

## 尚需在界面完成的步骤

仓库中的安装脚本和说明不等于账号内的环境已经创建或发布。必须在环境界面完成仓库选择、安装验证及 Publish；本次实际状态以迁移报告为准。GitHub Secrets、云环境机密、Sites／腾讯云部署凭据不能靠复制代码自动迁移。

官方说明：
- https://learn.chatgpt.com/docs/environments/cloud-environments
- https://learn.chatgpt.com/docs/environments/local-environment

