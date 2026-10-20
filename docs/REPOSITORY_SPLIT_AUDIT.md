# 仓库拆分审计与回滚记录（2026-10-20）

## 审计结论

- 两个仓库均为私有；连接有 push/admin 元数据权限，但连接不支持 Secrets、hooks、部署等全部管理接口。
- 初始 hengxiao-yiyun/main: 348d83e5788fbcaa09f337997f794ec36501f888，仅网站源码，没有京东目录。
- 网站较新分支 organize/modules-and-handoff-20261018: bff8c2632b94d05f4add0f468e150adc1c18da3e；PR #1 尚未合并。保留该分支、PR 和网站标签 v1.4.1-portable / v1.4.2-desktop。
- 京东交付分支 jd-helper-delivery-20261020: 22eb93ca8e561907614abcff21d7de92c315fa40；父提交 f5bbd2c0e4c94d1bc59ec4da585b8fddc507bc51 新增交付 workflow，再前为网站 main。京东源代码以 ZIP 保存，不是根目录源码，也没有发现更早独立应用提交历史。
- jd-helper 审计开始时为空。本次建立来源记录和迁移分支，迁移期间 main 又由另一处操作更新到 839d3d14bf0a829528519e78c15c52a326a43b93。已采用保留最新 main 的合并方式，只追加审计材料，不覆盖其 README、AGENTS、.gitignore 或环境文件。

## 边界与依赖

网站为 React 19 / Vite 8 / TypeScript / Node HTTP / SQLite，package.json 要求 Node >=24.15 <25。main 无 package-lock.json，较新网站分支有锁文件。网站保留 web/、src/、runtime/、dist/、media-parts/、deploy/、文档与素材；不要将它们带入京东仓库。main 的 scripts/build.mjs 读取 dist/favicon.svg，但初始 main 没有该文件；交付分支和较新网站分支有。网站 main 构建存在此基线问题，本次不以较旧 main 覆盖新版本或擅自合并 PR #1。

京东为 Electron 44.9.1 / Playwright Core 1.64.1 / TypeScript 7.0.2 / esbuild 0.28.2，Node 24，独立 package-lock.json。业务源代码在 src/ 和 ui/；脚本、测试、截图及使用说明均在原 ZIP 的23个条目内。本机 Edge 仅用于本地模拟测试。

## 验证证据

原源码 ZIP：368095 字节，SHA-256 45a8e784d2556c204ecce0fc91ae627b5b5709ab86728178a0083427ad1381af，与旧 manifest 一致。恢复出的23个文件与本次迁移分支的 Git blob 哈希全部一致。并发更新后的 main 中21个文件仍完全一致，只有 README.md 和 .gitignore 有预期的文档／忽略规则变化；应用代码、锁文件、两张截图及测试文件完全一致。

Windows / Node 24.15.0：npm ci --ignore-scripts、npm run typecheck、npm run build 通过；JDH_TEST_BROWSER 指向本机 Edge，node --test tests/*.test.cjs 为26通过、0失败。未启动真实购买、未登录京东、未输入密码、未做 Electron 界面或网站真机验收。

## 工作流、密钥与部署

旧交付 workflow 使用 github.token、contents:write，重组211个安装包分片并核验SHA-256，上传Release时使用--clobber。它不适合直接复制成日常开发CI，本次未在新仓库启用它。新main已有ci.yml和手动windows-package.yml；手动打包只生成新构件，不能冒充原安装包。

网站 deploy/ 为 Caddy + systemd 示例，目录 /opt/fenghua、127.0.0.1:3000、TRUST_PROXY=1；不是本次已执行的部署。Sites线上实现与此Node独立版是不同部署，不会因拆仓自动更新。

代码侧涉及的配置包括网站 PORT/HOST/TRUST_PROXY/LOCAL_PREVIEW，以及京东 JDH_TEST_BROWSER/JDH_TEST_HEADLESS/JDH_TEST_DATA_DIR。网站密码、会话、SQLite及上传媒体在data/；京东登录资料和订单记录在用户AppData。它们均不应迁移为源码。没有复制凭据或生产数据。当前连接无法审计Secrets真实值、webhooks、所有外部部署绑定；不能宣称已完成全账号密钥或部署审计。

## 归档与回滚

原Windows ZIP为161773998字节，SHA-256 030f6a477622e655e2be07001af90fb7681bab629b8c24e4ddf8a6d3429685f1，仍保留在旧仓库Release：
https://github.com/Richardsqg/hengxiao-yiyun/releases/tag/jd-helper-0.1.0-delivery-20261020

本次没有完成161MB安装包到新Release的完整复制；复制尝试只创建了部分未挂接Git对象，没有将半成品目录提交到分支。新仓库已额外保留原源码ZIP，路径migration-archive/JDHelper-Source.zip。不要删除旧交付分支、tag、Release或构件。新仓库的v0.1.0 Release在本次最终核查时尚不存在，不将计划下载链接说成可用下载。

回滚直接从上述不可变提交／源码ZIP恢复。新增文档和脚本可用git revert撤销；禁止force push和改写共享历史。网站main、较新网站分支、网站PR和正式数据不变。

## 未完成与下一步

1. 原安装包仍需按字节复制到新私有仓库Release，核对大小和SHA-256后才可考虑清理旧交付内容。
2. 源仓库历史京东交付分支/tag/Release尚在，尚未达到“整个仓库所有历史引用仅网站”；当前main已仅网站。清理必须经用户确认，本次没有执行删除。
3. 两个账号级Codex云环境尚未创建或发布。仓库脚本不等于账号环境；浏览器入口访问超时，现有连接无创建云环境API。按CODEX_PROJECT_GUIDE.md完成选择仓库、准备、验证和Publish。
4. 网站较新PR #1是否合并应单独审阅，不能与京东拆分合并为一个未经确认的版本升级。
5. 外部部署、Secrets管理设置及用户Windows真实京东流程待分别验证。
