# 展馆的独立 Codex 环境

仓库固定为 `Richardsqg/hengxiao-yiyun`，建议环境名 `hengxiao-yiyun-gallery`。本项目的包名是 `fenghua-mainland`；京东助手属于独立仓库 `Richardsqg/jd-helper`。

## 当前配置材料

- `.codex/project.json`：项目标记与 Node.js 版本要求。
- `.codex/verify-project.mjs`：检查目录、包名、Git remote，防止在错误项目中修改。
- `.codex/setup.sh`：安装依赖、构建；不运行 configure，不改密码或数据库。
- `.codex/check.sh`：运行现有测试，使用临时测试数据。
- `.codex/start.md`：启动与数据边界说明。

这些文件不会自动改变账号中的云环境。当前聊天仍保留原来的工作区状态；要使用新的绑定，需要在界面发布环境并开新任务。

## 创建或整理展馆环境

在电脑网页版或桌面端进入 `Settings → Codex Cloud → Environments`。可编辑现有展馆环境，确认只检出本仓库；如果旧环境已混有多个项目，建议新建一个干净环境。

输入以下准备要求：

> 环境名 hengxiao-yiyun-gallery，仅检出 Richardsqg/hengxiao-yiyun 的 main 分支。使用 Node.js 24.15 或更新的 24.x，先读 AGENTS.md、.codex/project.json 和 .codex/start.md，运行 bash .codex/setup.sh，再运行 bash .codex/check.sh。不要导入京东工具，不运行 configure，不覆盖 data/、backups/、密码或生产配置。完成后展示准备报告，供我发布环境。

检查报告，点击 Publish / Republish。新任务选择此环境。现有旧任务不会自动切换；不要在展馆任务中接着开发京东工具。

## 以后新建项目

先在 GitHub 新建独立私有仓库并授权给 Codex，再在电脑网页或桌面端创建只绑定新仓库的环境。让 Codex 按新项目准备依赖和测试，通过后发布，再从那个环境开任务。iPhone 用于选择已发布环境和发任务。不要仅在展馆聊天里说“做一个新软件”就沿用当前环境。

本地开发使用不同文件夹克隆不同仓库，在 Codex 打开对应文件夹。仓库保存代码；环境提供工具；聊天任务保留自己的工作状态，三者不等同。

官方说明：https://learn.chatgpt.com/docs/environments/cloud-environments

## 关于这次分离

展馆原主分支没有京东源码。此前京东安装包借用了本仓库的独立交付分支、Release 和 Actions。先迁移到 jd-helper 并验证原包，再清理这些京东专用交付入口。不会重写展馆主分支历史，也不改变展馆网页或线上部署。
