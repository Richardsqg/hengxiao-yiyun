# 两个项目分离完成报告 · 2026-10-20

## 仓库与环境建议

| 项目 | 独立仓库 | 建议的私人云环境名称 |
| --- | --- | --- |
| 横小艺韵展馆 | Richardsqg/hengxiao-yiyun | hengxiao-yiyun-gallery |
| 京东桌面助手 | Richardsqg/jd-helper | jd-helper-desktop |

每个环境仅选择表中对应的一个仓库，默认分支 main。不要把两个仓库一起加入同一个项目环境。

## 已实际完成

- 助手完整源码在 jd-helper 根目录；已有迁移 PR 和来源记录保留。
- 原 Windows ZIP 和原源码归档已按字节迁入 jd-helper 的 v0.1.0 Release，没有重新编译安装包。
- Windows ZIP 为 161,773,998 字节，SHA-256 为 030f6a477622e655e2be07001af90fb7681bab629b8c24e4ddf8a6d3429685f1。
- 展馆仓库的京东专用交付分支 jd-helper-delivery-20261020、同名用途的旧 Release / tag、旧 Actions run 39389305780 及其构件已在新发布验证后清理。
- 旧交付元数据保存在 jd-helper/migration-archive/legacy-delivery-record.json；原工作区 ZIP 备份保留。
- 两仓库各有 .codex/project.json、verify-project.mjs、setup.sh、check.sh、start.md。选错仓库会被检查拒绝。
- 展馆构建与 36 项测试通过；助手类型检查、26 项模拟测试和独立 GitHub CI 通过。
- 既有助手业务文件 14 个保持原字节；展馆原有文件中只修改接手说明 AGENTS.md，其余 149 个保持原字节，另增加环境配置、依赖锁文件和文档。
- 没有重写展馆主分支历史，没有部署或修改线上站点，没有复制真实数据库、密码、Cookie 或 Edge 登录资料。

## 仍需在你的 Codex 界面完成的步骤

这次操作没有创建或发布账号中的两个云环境。当前可用工具只有环境读取接口；仓库中的脚本不会自动成为账号中的已发布环境。

1. 在电脑网页或桌面端打开 Settings → Codex Cloud → Environments，选择 Create environment。
2. 创建 jd-helper-desktop，仅勾选 Richardsqg/jd-helper；私人访问，main 分支。
3. 在准备对话中输入：先读 AGENTS.md 和 .codex/start.md，使用 Node.js 24.15 或更高的 24.x，运行 bash .codex/setup.sh，再运行 bash .codex/check.sh；只做模拟验证，不触发真实下单。
4. 查看准备报告，完成缺失项，点击 Publish。显示已发布后从这个环境开一个新任务。
5. 同样创建 hengxiao-yiyun-gallery，仅勾选 Richardsqg/hengxiao-yiyun，运行同名准备与检查脚本；不要运行 configure 或覆盖现有数据和密码。验证后发布。
6. 旧环境可以保留作回退，等新环境确认可用再自行归档。当前旧聊天不会自动切换到新环境。

如果现有展馆环境已经只绑定 hengxiao-yiyun，且准备状态正常，也可以继续用它做展馆；京东任务必须从独立京东环境新建。

## 后续新项目的固定流程

先建新的 GitHub 私有仓库 → 给 Codex 授权该仓库 → 创建只绑定它的独立环境 → 准备、验证并发布 → 从新环境开任务。每次任务先核对仓库名和 AGENTS.md，再开始修改。

仓库保存代码与版本，环境提供运行工具，聊天任务保存自己的工作状态；三者不是同一个东西。iPhone 可以选择已发布环境发任务，创建新环境按官方流程在电脑网页或桌面端完成。

## 新入口

- 京东源码：https://github.com/Richardsqg/jd-helper
- Windows 包：https://github.com/Richardsqg/jd-helper/releases/tag/v0.1.0
- 展馆源码：https://github.com/Richardsqg/hengxiao-yiyun
- 官方环境说明：https://learn.chatgpt.com/docs/environments/cloud-environments

GitHub 删除分支和 tag 后，历史对象不会立即物理回收，仓库显示体积可能延后下降。本次没有为了减小体积强行重写共享历史。真实 Windows / 京东页面适配仍以原验证记录为准，仓库分离不代表实盘抢购验证通过。
